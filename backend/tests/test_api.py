from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models import Base, Review
from backend.app.transform import (
    PLAYTIME_BUCKETS,
    clean_votes_funny,
    make_excerpt,
    parse_bool,
    parse_optional_float,
)

ALPHA = 10
BETA = 20
ID_NULL = 3_000_000_001
ID_LT1 = 3_000_000_002
ID_H1 = 3_000_000_003
ID_H5 = 3_000_000_004
AUTHOR_A = 76_561_198_000_000_001
AUTHOR_B = 76_561_198_000_000_002
AUTHOR_C = 76_561_198_000_000_003
TS_NULL = 1_700_000_100
TS_LT1 = 1_700_000_300
TS_H1 = 1_700_000_400
TS_H5 = 1_700_000_200

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def _iso(timestamp: int) -> str:
    moment = datetime.fromtimestamp(timestamp, tz=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _sample_reviews() -> list[Review]:
    return [
        Review(
            review_id=ID_NULL,
            app_id=ALPHA,
            app_name="Alpha",
            language="english",
            recommended=True,
            votes_helpful=5,
            votes_funny=3,
            comment_count=1,
            weighted_vote_score=0.5,
            timestamp_created=TS_NULL,
            timestamp_updated=TS_NULL,
            author_steamid=AUTHOR_A,
            playtime_at_review=None,
            playtime_forever=100.0,
            steam_purchase=True,
            received_for_free=False,
            early_access=False,
            excerpt="alpha one",
        ),
        Review(
            review_id=ID_LT1,
            app_id=ALPHA,
            app_name="Alpha",
            language="brazilian",
            recommended=False,
            votes_helpful=1,
            votes_funny=0,
            comment_count=2,
            weighted_vote_score=0.1,
            timestamp_created=TS_LT1,
            timestamp_updated=TS_LT1,
            author_steamid=AUTHOR_B,
            playtime_at_review=30,
            playtime_forever=40,
            steam_purchase=False,
            received_for_free=True,
            early_access=True,
            excerpt="alpha br",
        ),
        Review(
            review_id=ID_H1,
            app_id=BETA,
            app_name="Beta",
            language="english",
            recommended=True,
            votes_helpful=4,
            votes_funny=2,
            comment_count=0,
            weighted_vote_score=0.8,
            timestamp_created=TS_H1,
            timestamp_updated=TS_H1,
            author_steamid=AUTHOR_C,
            playtime_at_review=90,
            playtime_forever=120,
            steam_purchase=True,
            received_for_free=False,
            early_access=False,
            excerpt="beta short",
        ),
        Review(
            review_id=ID_H5,
            app_id=BETA,
            app_name="Beta",
            language="english",
            recommended=False,
            votes_helpful=0,
            votes_funny=1,
            comment_count=3,
            weighted_vote_score=0.0,
            timestamp_created=TS_H5,
            timestamp_updated=TS_H5,
            author_steamid=AUTHOR_A,
            playtime_at_review=400,
            playtime_forever=500,
            steam_purchase=True,
            received_for_free=True,
            early_access=True,
            excerpt="beta long",
        ),
    ]


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        session.add_all(_sample_reviews())
        session.commit()

    def override_get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_review_ids_are_64_bit():
    assert isinstance(Review.__table__.c.review_id.type, BigInteger)
    assert isinstance(Review.__table__.c.author_steamid.type, BigInteger)
    indexed = set()
    for index in Review.__table__.indexes:
        indexed.update(column.name for column in index.columns)
    assert {
        "app_id",
        "language",
        "recommended",
        "timestamp_created",
        "playtime_at_review",
        "steam_purchase",
        "received_for_free",
        "early_access",
    } <= indexed


def test_playtime_bucket_bounds():
    assert PLAYTIME_BUCKETS == {
        "lt1": (None, 60),
        "h1_2": (60, 120),
        "h2_5": (120, 300),
        "h5_10": (300, 600),
        "h10_25": (600, 1500),
        "h25_50": (1500, 3000),
        "h50_100": (3000, 6000),
        "h100_500": (6000, 30000),
        "gte500": (30000, None),
    }


def test_parse_bool_and_optional_float():
    assert parse_bool("True") is True
    assert parse_bool("false") is False
    assert parse_bool("YES") is True
    assert parse_bool("1") is True
    assert parse_bool("0") is False
    assert parse_bool("no") is False
    assert parse_optional_float("") is None
    assert parse_optional_float("   ") is None
    assert parse_optional_float("5517.0") == 5517.0
    assert parse_optional_float("0") == 0.0


def test_make_excerpt_collapses_and_cuts():
    assert make_excerpt(None) == ""
    assert make_excerpt("  foo \n\t bar  ") == "foo bar"
    excerpt = make_excerpt("a  b\n" + ("x" * 400))
    assert excerpt.startswith("a b ")
    assert len(excerpt) == 280
    assert "\n" not in excerpt
    assert "  " not in excerpt


def test_clean_votes_funny():
    assert clean_votes_funny(4294967295) == 0
    assert clean_votes_funny("4294967295") == 0
    assert clean_votes_funny(3) == 3
    assert clean_votes_funny("1.0") == 1
    assert clean_votes_funny("4294967291") == 4294967291
    assert clean_votes_funny("4294967292") == 0


def test_metrics_unfiltered(client):
    response = client.get("/api/metrics")
    assert response.status_code == 200
    body = response.json()
    assert client.get("/api/summary").json() == body
    assert body["total_reviews"] == 4
    assert body["recommendation_rate"] == 0.5
    assert body["game_count"] == 2
    assert body["author_count"] == 3
    assert body["games"] == [
        {"app_id": ALPHA, "app_name": "Alpha", "review_count": 2},
        {"app_id": BETA, "app_name": "Beta", "review_count": 2},
    ]
    assert body["languages"] == [
        {"language": "english", "review_count": 3},
        {"language": "brazilian", "review_count": 1},
    ]


def test_metrics_recommended_false(client):
    response = client.get("/api/metrics", params={"recommended": "false"})
    assert response.status_code == 200
    body = response.json()
    assert body["total_reviews"] == 2
    assert body["recommendation_rate"] == 0.0
    assert body["game_count"] == 2
    assert body["author_count"] == 2
    assert sum(game["review_count"] for game in body["games"]) == 4
    assert body["languages"] == [
        {"language": "english", "review_count": 3},
        {"language": "brazilian", "review_count": 1},
    ]


def test_metrics_playtime_bucket_lt1_ignores_null(client):
    response = client.get("/api/metrics", params={"playtime_bucket": "lt1"})
    assert response.status_code == 200
    body = response.json()
    assert body["total_reviews"] == 1
    assert body["recommendation_rate"] == 0.0
    reviews = client.get("/api/reviews", params={"playtime_bucket": "lt1"})
    assert reviews.status_code == 200
    items = reviews.json()["items"]
    assert [item["review_id"] for item in items] == [ID_LT1]
    assert items[0]["playtime_at_review_hours"] == 0.5


def test_reviews_filter_app_and_language(client):
    response = client.get(
        "/api/reviews",
        params={"app_id": ALPHA, "language": "brazilian"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["review_id"] == ID_LT1
    assert item["app_id"] == ALPHA
    assert item["app_name"] == "Alpha"
    assert item["language"] == "brazilian"
    assert item["recommended"] is False
    assert item["votes_helpful"] == 1
    assert item["votes_funny"] == 0
    assert item["comment_count"] == 2
    assert item["playtime_at_review_hours"] == 0.5
    assert item["steam_purchase"] is False
    assert item["received_for_free"] is True
    assert item["early_access"] is True
    assert item["created_at"] == _iso(TS_LT1)
    assert item["excerpt"] == "alpha br"

    english = client.get(
        "/api/reviews",
        params={"app_id": ALPHA, "language": "english"},
    )
    assert english.status_code == 200
    english_item = english.json()["items"][0]
    assert english_item["review_id"] == ID_NULL
    assert english_item["playtime_at_review_hours"] is None
    assert english_item["created_at"] == _iso(TS_NULL)


def test_reviews_pagination(client):
    response = client.get("/api/reviews", params={"limit": 2, "offset": 1})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 4
    assert body["limit"] == 2
    assert body["offset"] == 1
    assert [item["review_id"] for item in body["items"]] == [ID_LT1, ID_H5]

    first = client.get("/api/reviews", params={"limit": 1, "offset": 0})
    assert first.json()["items"][0]["review_id"] == ID_H1
    assert first.json()["items"][0]["playtime_at_review_hours"] == 1.5

    tail = client.get("/api/reviews", params={"limit": 2, "offset": 2})
    tail_items = tail.json()["items"]
    assert [item["review_id"] for item in tail_items] == [ID_H5, ID_NULL]
    assert tail_items[0]["playtime_at_review_hours"] == 6.67
    assert tail_items[1]["playtime_at_review_hours"] is None


def test_charts_follow_filters(client):
    response = client.get("/api/charts")
    assert response.status_code == 200
    body = response.json()
    assert [point["key"] for point in body["playtime"]] == [
        "lt1",
        "h1_2",
        "h2_5",
        "h5_10",
        "h10_25",
        "h25_50",
        "h50_100",
        "h100_500",
        "gte500",
    ]
    by_key = {point["key"]: point for point in body["playtime"]}
    assert by_key["lt1"]["label"] == "<1 h"
    assert by_key["lt1"]["review_count"] == 1
    assert by_key["lt1"]["recommendation_rate"] == 0
    assert by_key["h1_2"]["review_count"] == 1
    assert by_key["h1_2"]["recommendation_rate"] == 1
    assert by_key["h5_10"]["review_count"] == 1
    assert by_key["h5_10"]["recommendation_rate"] == 0
    assert by_key["h2_5"]["review_count"] == 0
    assert by_key["h2_5"]["recommendation_rate"] is None
    assert body["games"] == [
        {"app_name": "Alpha", "review_count": 2},
        {"app_name": "Beta", "review_count": 2},
    ]
    assert [item["language"] for item in body["languages"]] == ["english", "brazilian"]
    assert body["languages"][0]["recommendation_rate"] == pytest.approx(2 / 3)
    assert body["languages"][0]["review_count"] == 3
    assert len(body["months"]) == 1
    assert body["months"][0]["review_count"] == 4

    alpha = client.get("/api/charts", params={"app_id": ALPHA})
    assert alpha.status_code == 200
    assert alpha.json()["games"] == [{"app_name": "Alpha", "review_count": 2}]


@pytest.mark.parametrize("path", ["/api/metrics", "/api/summary", "/api/reviews", "/api/charts"])
def test_invalid_playtime_bucket_returns_422(client, path):
    response = client.get(path, params={"playtime_bucket": "nope"})
    assert response.status_code == 422
    assert "nope" in response.text
    assert "playtime_bucket" in response.text
