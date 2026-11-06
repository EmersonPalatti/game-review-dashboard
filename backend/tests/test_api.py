from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import BigInteger, create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.database import get_db
from backend.app.main import app
from backend.app.models import Base, Review
from backend.app.queries import clear_cache
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
    clear_cache()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as session:
        session.add_all(_sample_reviews())
        session.commit()

    import backend.app.main as main_mod
    orig_session_local = main_mod.SessionLocal
    main_mod.SessionLocal = SessionLocal

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
        main_mod.SessionLocal = orig_session_local
        app.dependency_overrides.clear()
        clear_cache()


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


def test_reviews_sorting(client):
    helpful_desc = client.get(
        "/api/reviews", params={"sort_by": "votes_helpful", "sort_dir": "desc"}
    )
    assert helpful_desc.status_code == 200
    assert [item["review_id"] for item in helpful_desc.json()["items"]] == [
        ID_NULL,
        ID_H1,
        ID_LT1,
        ID_H5,
    ]

    helpful_asc = client.get(
        "/api/reviews", params={"sort_by": "votes_helpful", "sort_dir": "asc"}
    )
    assert helpful_asc.status_code == 200
    assert [item["review_id"] for item in helpful_asc.json()["items"]] == [
        ID_H5,
        ID_LT1,
        ID_H1,
        ID_NULL,
    ]

    playtime_desc = client.get(
        "/api/reviews", params={"sort_by": "playtime_hours", "sort_dir": "desc"}
    )
    assert playtime_desc.status_code == 200
    assert [item["review_id"] for item in playtime_desc.json()["items"]] == [
        ID_H5,
        ID_H1,
        ID_LT1,
        ID_NULL,
    ]

    playtime_asc = client.get(
        "/api/reviews", params={"sort_by": "playtime_hours", "sort_dir": "asc"}
    )
    assert playtime_asc.status_code == 200
    assert [item["review_id"] for item in playtime_asc.json()["items"]] == [
        ID_LT1,
        ID_H1,
        ID_H5,
        ID_NULL,
    ]

    invalid = client.get("/api/reviews", params={"sort_by": "invalid"})
    assert invalid.status_code == 422


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

    # Crossfilter clássico: ao filtrar por playtime_bucket, a distribuição de playtime
    # preserva todas as faixas (para manter as 8 barras visíveis e atenuadas no gráfico),
    # enquanto games, languages e months são filtrados.
    filtered_playtime = client.get("/api/charts", params={"playtime_bucket": "lt1"})
    assert filtered_playtime.status_code == 200
    fp_body = filtered_playtime.json()
    fp_by_key = {point["key"]: point for point in fp_body["playtime"]}
    assert fp_by_key["lt1"]["review_count"] == 1
    assert fp_by_key["h1_2"]["review_count"] == 1
    assert fp_by_key["h5_10"]["review_count"] == 1
    assert fp_body["games"] == [{"app_name": "Alpha", "review_count": 1}]

    # Ao filtrar um único mês (date_from e date_to no mesmo AAAA-MM), a série mensal
    # preserva a curva completa para destacar o mês selecionado sem colapsar para 1 ponto,
    # enquanto os demais painéis são filtrados pelo mês.
    single_month = client.get(
        "/api/charts",
        params={"date_from": "2023-10-01", "date_to": "2023-10-31"},
    )
    assert single_month.status_code == 200
    sm_body = single_month.json()
    assert sm_body["games"] == []
    assert sm_body["languages"] == []
    assert sm_body["months"] == [{"month": "2023-11", "review_count": 4}]

    # Intervalos de múltiplos meses (como os presets de ano) aplicam zoom na série mensal.
    multi_month = client.get(
        "/api/charts",
        params={"date_from": "2023-01-01", "date_to": "2023-10-31"},
    )
    assert multi_month.status_code == 200
    mm_body = multi_month.json()
    assert mm_body["months"] == []


@pytest.mark.parametrize("path", ["/api/metrics", "/api/summary", "/api/reviews", "/api/charts"])
def test_invalid_playtime_bucket_returns_422(client, path):
    response = client.get(path, params={"playtime_bucket": "nope"})
    assert response.status_code == 422
    assert "nope" in response.text
    assert "playtime_bucket" in response.text


@pytest.mark.parametrize("path", ["/api/summary", "/api/charts", "/api/reviews"])
def test_date_filtering_matching(client, path):
    response = client.get(path, params={"date_from": "2023-11-14", "date_to": "2023-11-14"})
    assert response.status_code == 200
    data = response.json()
    if path == "/api/summary":
        assert data["total_reviews"] == 4
        assert data["recommendation_rate"] == 0.5
    elif path == "/api/charts":
        assert len(data["games"]) == 2
        assert data["months"][0]["review_count"] == 4
    elif path == "/api/reviews":
        assert data["total"] == 4
        assert len(data["items"]) == 4


@pytest.mark.parametrize("path", ["/api/summary", "/api/charts", "/api/reviews"])
def test_date_filtering_no_matching(client, path):
    response = client.get(path, params={"date_from": "2023-11-15"})
    assert response.status_code == 200
    data = response.json()
    if path == "/api/summary":
        assert data["total_reviews"] == 0
        assert data["recommendation_rate"] == 0.0
        assert data["game_count"] == 0
        assert data["author_count"] == 0
    elif path == "/api/charts":
        assert data["games"] == []
        assert data["languages"] == []
        assert data["months"] == []
        for point in data["playtime"]:
            assert point["review_count"] == 0
    elif path == "/api/reviews":
        assert data["total"] == 0
        assert data["items"] == []


@pytest.mark.parametrize("path", ["/api/summary", "/api/charts", "/api/reviews"])
def test_date_filtering_boundary_conditions(client, path):
    # Boundary before: date_to on previous day excludes all reviews
    res_before = client.get(path, params={"date_to": "2023-11-13"})
    assert res_before.status_code == 200
    if path == "/api/summary":
        assert res_before.json()["total_reviews"] == 0
    elif path == "/api/reviews":
        assert res_before.json()["total"] == 0

    # Boundary open range: only date_from=2023-11-14 includes all reviews
    res_from_only = client.get(path, params={"date_from": "2023-11-14"})
    assert res_from_only.status_code == 200
    if path == "/api/summary":
        assert res_from_only.json()["total_reviews"] == 4
    elif path == "/api/reviews":
        assert res_from_only.json()["total"] == 4

    # Boundary open range: only date_to=2023-11-14 includes all reviews
    res_to_only = client.get(path, params={"date_to": "2023-11-14"})
    assert res_to_only.status_code == 200
    if path == "/api/summary":
        assert res_to_only.json()["total_reviews"] == 4
    elif path == "/api/reviews":
        assert res_to_only.json()["total"] == 4


def test_date_filtering_exact_second_boundaries():
    from sqlalchemy import select

    from backend.app.queries import apply_filters
    from backend.app.schemas import ReviewFilters

    test_engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(test_engine)
    TestSession = sessionmaker(bind=test_engine)

    # 2023-11-14 00:00:00 UTC is 1699920000
    # 2023-11-14 23:59:59 UTC is 1700006399
    r_before = Review(
        review_id=901,
        app_id=1,
        app_name="Test",
        language="en",
        recommended=True,
        votes_helpful=0,
        votes_funny=0,
        comment_count=0,
        weighted_vote_score=0.0,
        timestamp_created=1699919999,  # 2023-11-13 23:59:59 UTC
        timestamp_updated=1699919999,
        author_steamid=111,
        steam_purchase=True,
        received_for_free=False,
        early_access=False,
        excerpt="",
    )
    r_start = Review(
        review_id=902,
        app_id=1,
        app_name="Test",
        language="en",
        recommended=True,
        votes_helpful=0,
        votes_funny=0,
        comment_count=0,
        weighted_vote_score=0.0,
        timestamp_created=1699920000,  # 2023-11-14 00:00:00 UTC
        timestamp_updated=1699920000,
        author_steamid=112,
        steam_purchase=True,
        received_for_free=False,
        early_access=False,
        excerpt="",
    )
    r_end = Review(
        review_id=903,
        app_id=1,
        app_name="Test",
        language="en",
        recommended=True,
        votes_helpful=0,
        votes_funny=0,
        comment_count=0,
        weighted_vote_score=0.0,
        timestamp_created=1700006399,  # 2023-11-14 23:59:59 UTC
        timestamp_updated=1700006399,
        author_steamid=113,
        steam_purchase=True,
        received_for_free=False,
        early_access=False,
        excerpt="",
    )
    r_after = Review(
        review_id=904,
        app_id=1,
        app_name="Test",
        language="en",
        recommended=True,
        votes_helpful=0,
        votes_funny=0,
        comment_count=0,
        weighted_vote_score=0.0,
        timestamp_created=1700006400,  # 2023-11-15 00:00:00 UTC
        timestamp_updated=1700006400,
        author_steamid=114,
        steam_purchase=True,
        received_for_free=False,
        early_access=False,
        excerpt="",
    )

    with TestSession() as session:
        session.add_all([r_before, r_start, r_end, r_after])
        session.commit()

        # date_from and date_to both 2023-11-14 should match r_start and r_end only
        stmt = apply_filters(
            select(Review.review_id),
            ReviewFilters(date_from="2023-11-14", date_to="2023-11-14"),
        )
        matched_ids = session.scalars(stmt).all()
        assert set(matched_ids) == {902, 903}


@pytest.mark.parametrize("path", ["/api/summary", "/api/charts", "/api/reviews"])
@pytest.mark.parametrize(
    "param_name,invalid_value",
    [
        ("date_from", "invalid"),
        ("date_from", "2023-13-01"),
        ("date_from", "2023-02-30"),
        ("date_to", "invalid"),
        ("date_to", "2023-99-99"),
        ("date_to", "2023-04-31"),
    ],
)
def test_invalid_date_format_returns_422(client, path, param_name, invalid_value):
    response = client.get(path, params={param_name: invalid_value})
    assert response.status_code == 422


def test_apply_filters_invalid_date_raises_http_exception():
    from fastapi import HTTPException
    from sqlalchemy import select

    from backend.app.queries import apply_filters
    from backend.app.schemas import ReviewFilters

    with pytest.raises(HTTPException) as exc_info_from:
        apply_filters(select(Review), ReviewFilters(date_from="2023-02-30"))
    assert exc_info_from.value.status_code == 422
    assert exc_info_from.value.detail == "Data inválida. Use o formato AAAA-MM-DD."

    with pytest.raises(HTTPException) as exc_info_to:
        apply_filters(select(Review), ReviewFilters(date_to="not-valid"))
    assert exc_info_to.value.status_code == 422
    assert exc_info_to.value.detail == "Data inválida. Use o formato AAAA-MM-DD."


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cache_control_headers(client):
    res_summary = client.get("/api/summary")
    assert res_summary.status_code == 200
    assert (
        res_summary.headers.get("Cache-Control")
        == "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )

    res_metrics = client.get("/api/metrics")
    assert res_metrics.status_code == 200
    assert (
        res_metrics.headers.get("Cache-Control")
        == "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )

    res_charts = client.get("/api/charts")
    assert res_charts.status_code == 200
    assert (
        res_charts.headers.get("Cache-Control")
        == "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )

    res_reviews = client.get("/api/reviews")
    assert res_reviews.status_code == 200
    assert (
        res_reviews.headers.get("Cache-Control")
        == "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600"
    )


def test_in_memory_caching_and_warmup():
    from backend.app.queries import (
        _charts_cache,
        _metrics_cache,
        charts,
        clear_cache,
        metrics,
        warmup_caches,
    )
    from backend.app.schemas import ReviewFilters

    test_engine = create_engine("sqlite://", poolclass=StaticPool)
    Base.metadata.create_all(test_engine)
    TestSession = sessionmaker(bind=test_engine)

    with TestSession() as session:
        session.add_all(_sample_reviews())
        session.commit()

        clear_cache()
        assert len(_metrics_cache._cache) == 0
        assert len(_charts_cache._cache) == 0

        # warmup_caches populates the default filters cache
        warmup_caches(session)
        assert len(_metrics_cache._cache) == 1
        assert len(_charts_cache._cache) == 1

        # Second call returns the cached object
        m1 = metrics(session, ReviewFilters())
        m2 = metrics(session, ReviewFilters())
        assert m1 is m2

        c1 = charts(session, ReviewFilters())
        c2 = charts(session, ReviewFilters())
        assert c1 is c2

        clear_cache()
        assert len(_metrics_cache._cache) == 0
        assert len(_charts_cache._cache) == 0

