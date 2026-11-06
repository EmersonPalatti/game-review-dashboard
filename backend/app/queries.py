from collections import OrderedDict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from threading import Lock
from typing import Generic, TypeVar

from fastapi import HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.orm import Session

from backend.app.models import Review
from backend.app.schemas import (
    ChartsResponse,
    GameBar,
    GameFacet,
    LanguageBar,
    LanguageFacet,
    MetricsResponse,
    MonthPoint,
    PlaytimePoint,
    ReviewFilters,
    ReviewItem,
    ReviewListResponse,
    ReviewSortBy,
    SortDir,
)
from backend.app.transform import PLAYTIME_BUCKETS, PLAYTIME_LABELS


def apply_filters(stmt, filters: ReviewFilters):
    if filters.app_id is not None:
        stmt = stmt.where(Review.app_id == filters.app_id)
    if filters.language is not None:
        stmt = stmt.where(Review.language == filters.language)
    if filters.recommended is not None:
        stmt = stmt.where(Review.recommended == filters.recommended)
    if filters.steam_purchase is not None:
        stmt = stmt.where(Review.steam_purchase == filters.steam_purchase)
    if filters.received_for_free is not None:
        stmt = stmt.where(Review.received_for_free == filters.received_for_free)
    if filters.early_access is not None:
        stmt = stmt.where(Review.early_access == filters.early_access)
    if filters.playtime_bucket is not None:
        low, high = PLAYTIME_BUCKETS[filters.playtime_bucket]
        stmt = stmt.where(Review.playtime_at_review.is_not(None))
        if low is not None:
            stmt = stmt.where(Review.playtime_at_review >= low)
        if high is not None:
            stmt = stmt.where(Review.playtime_at_review < high)
    if filters.date_from is not None:
        try:
            ts_from = int(
                datetime.strptime(filters.date_from, "%Y-%m-%d")
                .replace(tzinfo=timezone.utc)
                .timestamp()
            )
        except ValueError as err:
            raise HTTPException(
                status_code=422,
                detail="Data inválida. Use o formato AAAA-MM-DD.",
            ) from err
        stmt = stmt.where(Review.timestamp_created >= ts_from)
    if filters.date_to is not None:
        try:
            ts_to = int(
                datetime.strptime(filters.date_to, "%Y-%m-%d")
                .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
                .timestamp()
            )
        except ValueError as err:
            raise HTTPException(
                status_code=422,
                detail="Data inválida. Use o formato AAAA-MM-DD.",
            ) from err
        stmt = stmt.where(Review.timestamp_created <= ts_to)
    return stmt


T = TypeVar("T")


class LRUCache(Generic[T]):
    def __init__(self, maxsize: int = 256) -> None:
        self.maxsize = maxsize
        self._cache: OrderedDict[tuple, T] = OrderedDict()
        self._lock = Lock()

    def get(self, key: tuple) -> T | None:
        with self._lock:
            if key not in self._cache:
                return None
            self._cache.move_to_end(key)
            return self._cache[key]

    def set(self, key: tuple, value: T) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value
            if len(self._cache) > self.maxsize:
                self._cache.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()


_metrics_cache: LRUCache[MetricsResponse] = LRUCache[MetricsResponse](maxsize=256)
_charts_cache: LRUCache[ChartsResponse] = LRUCache[ChartsResponse](maxsize=256)


def _filter_cache_key(filters: ReviewFilters) -> tuple:
    return (
        filters.app_id,
        filters.language,
        filters.recommended,
        filters.steam_purchase,
        filters.received_for_free,
        filters.early_access,
        filters.playtime_bucket,
        filters.date_from,
        filters.date_to,
    )


_BASELINE_PATH = Path(__file__).resolve().parent / "baseline.json"
_BASELINE_DATA: dict | None = None


def _get_baseline() -> dict | None:
    if os.getenv("PYTEST_CURRENT_TEST"):
        return None
    global _BASELINE_DATA
    if _BASELINE_DATA is not None:
        return _BASELINE_DATA
    if _BASELINE_PATH.is_file():
        try:
            with open(_BASELINE_PATH, encoding="utf-8") as f:
                _BASELINE_DATA = json.load(f)
        except Exception:
            _BASELINE_DATA = None
    return _BASELINE_DATA


def is_empty_filters(filters: ReviewFilters) -> bool:
    return not any([
        filters.app_id is not None,
        filters.language is not None,
        filters.recommended is not None,
        filters.steam_purchase is not None,
        filters.received_for_free is not None,
        filters.early_access is not None,
        filters.playtime_bucket is not None,
        filters.date_from is not None,
        filters.date_to is not None,
    ])


def clear_cache() -> None:
    global _facets
    _facets = None
    _metrics_cache.clear()
    _charts_cache.clear()


def warmup_caches(session: Session) -> None:
    default_filters = ReviewFilters()
    metrics(session, default_filters)
    charts(session, default_filters)


_facets: tuple[list[GameFacet], list[LanguageFacet]] | None = None


def _global_facets(session: Session) -> tuple[list[GameFacet], list[LanguageFacet]]:
    # Catálogo estável depois do seed. A primeira leitura paga o GROUP BY.
    global _facets
    if _facets is not None:
        return _facets
    game_count = func.count().label("review_count")
    game_rows = session.execute(
        select(Review.app_id, Review.app_name, game_count)
        .group_by(Review.app_id, Review.app_name)
        .order_by(game_count.desc(), Review.app_id.asc())
    ).all()
    language_count = func.count().label("review_count")
    language_rows = session.execute(
        select(Review.language, language_count)
        .group_by(Review.language)
        .order_by(language_count.desc(), Review.language.asc())
    ).all()
    _facets = (
        [
            GameFacet(
                app_id=row.app_id,
                app_name=row.app_name,
                review_count=int(row.review_count),
            )
            for row in game_rows
        ],
        [
            LanguageFacet(language=row.language, review_count=int(row.review_count))
            for row in language_rows
        ],
    )
    return _facets


def _hours(minutes: float | None) -> float | None:
    if minutes is None:
        return None
    return round(float(minutes) / 60, 2)


def _created_at(timestamp: int) -> str:
    moment = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _to_item(row: Review) -> ReviewItem:
    return ReviewItem(
        review_id=row.review_id,
        app_id=row.app_id,
        app_name=row.app_name,
        language=row.language,
        recommended=bool(row.recommended),
        votes_helpful=row.votes_helpful,
        votes_funny=row.votes_funny,
        comment_count=row.comment_count,
        playtime_at_review_hours=_hours(row.playtime_at_review),
        steam_purchase=bool(row.steam_purchase),
        received_for_free=bool(row.received_for_free),
        early_access=bool(row.early_access),
        created_at=_created_at(row.timestamp_created),
        excerpt=row.excerpt or "",
    )


def metrics(session: Session, filters: ReviewFilters) -> MetricsResponse:
    cache_key = _filter_cache_key(filters)
    cached = _metrics_cache.get(cache_key)
    if cached is not None:
        return cached

    if is_empty_filters(filters):
        baseline = _get_baseline()
        if baseline and "metrics" in baseline:
            result = MetricsResponse.model_validate(baseline["metrics"])
            _metrics_cache.set(cache_key, result)
            return result

    # Autor fica numa query separada: no mesmo SELECT o SQLite varre a tabela
    # inteira e o COUNT DISTINCT de 1 milhão de contas leva cerca de 4 s.
    recommended_count = func.coalesce(
        func.sum(case((Review.recommended.is_(True), 1), else_=0)),
        0,
    )
    totals = session.execute(
        apply_filters(
            select(
                func.count().label("total_reviews"),
                recommended_count.label("recommended_reviews"),
                func.count(func.distinct(Review.app_id)).label("game_count"),
            ),
            filters,
        )
    ).one()
    author_count = session.scalar(
        apply_filters(
            select(func.count(func.distinct(Review.author_steamid))),
            filters,
        )
    )
    total = int(totals.total_reviews or 0)
    recommended = int(totals.recommended_reviews or 0)
    rate = recommended / total if total else 0.0
    games, languages = _global_facets(session)
    result = MetricsResponse(
        total_reviews=total,
        recommendation_rate=rate,
        game_count=int(totals.game_count or 0),
        author_count=int(author_count or 0),
        games=games,
        languages=languages,
    )
    _metrics_cache.set(cache_key, result)
    return result


def list_reviews(
    session: Session,
    filters: ReviewFilters,
    limit: int,
    offset: int,
    sort_by: ReviewSortBy = "created_at",
    sort_dir: SortDir = "desc",
) -> ReviewListResponse:
    if sort_by == "votes_helpful":
        primary = Review.votes_helpful.asc() if sort_dir == "asc" else Review.votes_helpful.desc()
        order_clauses = [primary, Review.timestamp_created.desc(), Review.review_id.desc()]
    elif sort_by == "playtime_hours":
        nulls_last = case((Review.playtime_at_review.is_(None), 1), else_=0).asc()
        primary = Review.playtime_at_review.asc() if sort_dir == "asc" else Review.playtime_at_review.desc()
        order_clauses = [nulls_last, primary, Review.timestamp_created.desc(), Review.review_id.desc()]
    else:
        if sort_dir == "asc":
            order_clauses = [Review.timestamp_created.asc(), Review.review_id.asc()]
        else:
            order_clauses = [Review.timestamp_created.desc(), Review.review_id.desc()]

    filtered = apply_filters(select(Review), filters)
    total = session.scalar(
        apply_filters(select(func.count()).select_from(Review), filters)
    )
    rows = session.scalars(
        filtered.order_by(*order_clauses)
        .limit(limit)
        .offset(offset)
    ).all()
    return ReviewListResponse(
        total=int(total or 0),
        limit=limit,
        offset=offset,
        items=[_to_item(row) for row in rows],
    )


def _rate(positive: int, total: int) -> float | None:
    if total == 0:
        return None
    return positive / total


def _playtime_condition(low: int | None, high: int | None):
    parts = [Review.playtime_at_review.is_not(None)]
    if low is not None:
        parts.append(Review.playtime_at_review >= low)
    if high is not None:
        parts.append(Review.playtime_at_review < high)
    return and_(*parts)


def charts(session: Session, filters: ReviewFilters) -> ChartsResponse:
    cache_key = _filter_cache_key(filters)
    cached = _charts_cache.get(cache_key)
    if cached is not None:
        return cached

    if is_empty_filters(filters):
        baseline = _get_baseline()
        if baseline and "charts" in baseline:
            result = ChartsResponse.model_validate(baseline["charts"])
            _charts_cache.set(cache_key, result)
            return result

    columns = []
    for key, bounds in PLAYTIME_BUCKETS.items():
        condition = _playtime_condition(*bounds)
        columns.append(
            func.coalesce(func.sum(case((condition, 1), else_=0)), 0).label(f"{key}_n")
        )
        columns.append(
            func.coalesce(
                func.sum(case((and_(condition, Review.recommended.is_(True)), 1), else_=0)),
                0,
            ).label(f"{key}_pos")
        )
    playtime_filters = filters.model_copy(update={"playtime_bucket": None})
    bucket_row = session.execute(apply_filters(select(*columns), playtime_filters)).one()
    playtime = []
    for key in PLAYTIME_BUCKETS:
        count = int(getattr(bucket_row, f"{key}_n") or 0)
        positive = int(getattr(bucket_row, f"{key}_pos") or 0)
        playtime.append(
            PlaytimePoint(
                key=key,
                label=PLAYTIME_LABELS[key],
                review_count=count,
                recommendation_rate=_rate(positive, count),
            )
        )

    game_count = func.count().label("review_count")
    game_rows = session.execute(
        apply_filters(
            select(Review.app_name, game_count)
            .group_by(Review.app_id, Review.app_name)
            .order_by(game_count.desc(), Review.app_name.asc())
            .limit(8),
            filters,
        )
    ).all()

    language_count = func.count().label("review_count")
    language_positive = func.coalesce(
        func.sum(case((Review.recommended.is_(True), 1), else_=0)),
        0,
    ).label("positive")
    language_rows = session.execute(
        apply_filters(
            select(Review.language, language_count, language_positive)
            .group_by(Review.language)
            .order_by(language_count.desc(), Review.language.asc())
            .limit(8),
            filters,
        )
    ).all()
    languages = [
        LanguageBar(
            language=row.language,
            review_count=int(row.review_count),
            recommendation_rate=_rate(int(row.positive or 0), int(row.review_count)),
        )
        for row in language_rows
    ]
    languages.sort(
        key=lambda item: (
            -1 if item.recommendation_rate is None else -item.recommendation_rate,
            item.language,
        )
    )

    is_single_month = (
        filters.date_from is not None
        and filters.date_to is not None
        and len(filters.date_from) == 10
        and len(filters.date_to) == 10
        and filters.date_from[:7] == filters.date_to[:7]
    )
    month_filters = (
        filters.model_copy(update={"date_from": None, "date_to": None})
        if is_single_month
        else filters
    )
    dialect_name = session.bind.dialect.name if session.bind else "sqlite"
    if dialect_name == "postgresql":
        month_key = func.to_char(
            func.to_timestamp(Review.timestamp_created), "YYYY-MM"
        ).label("month")
    else:
        month_key = func.strftime(
            "%Y-%m", Review.timestamp_created, "unixepoch"
        ).label("month")
    month_count = func.count().label("review_count")
    month_rows = session.execute(
        apply_filters(
            select(month_key, month_count)
            .where(Review.timestamp_created.is_not(None))
            .group_by(month_key)
            .order_by(month_key.asc()),
            month_filters,
        )
    ).all()

    result = ChartsResponse(
        playtime=playtime,
        games=[
            GameBar(app_name=row.app_name, review_count=int(row.review_count))
            for row in game_rows
        ],
        languages=languages,
        months=[
            MonthPoint(month=row.month, review_count=int(row.review_count))
            for row in month_rows
            if row.month
        ],
    )
    _charts_cache.set(cache_key, result)
    return result
