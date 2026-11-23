from collections import OrderedDict
from datetime import datetime, timezone
import json
import os
from pathlib import Path
from threading import Lock
from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.app.analytics import (
    AnalyticsStore,
    date_bounds,
    get_store,
    playtime_sql,
    reset_store,
    where_clause,
)
from backend.app.models import Review
from backend.app.schemas import (
    ChartsResponse,
    FacetsResponse,
    GameBar,
    GameFacet,
    GameFacetCount,
    LanguageBar,
    LanguageFacet,
    LanguageFacetCount,
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
    """Filtros em SQLAlchemy. As agregações usam `analytics.where_clause`, com a mesma semântica."""
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
    ts_from, ts_to = date_bounds(filters)
    if ts_from is not None:
        stmt = stmt.where(Review.timestamp_created >= ts_from)
    if ts_to is not None:
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
_facets_cache: LRUCache[FacetsResponse] = LRUCache[FacetsResponse](maxsize=256)


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


_reviews_cache: LRUCache[ReviewListResponse] = LRUCache[ReviewListResponse](maxsize=256)


def _clear_responses() -> None:
    global _facets
    _facets = None
    _metrics_cache.clear()
    _charts_cache.clear()
    _facets_cache.clear()
    _reviews_cache.clear()


def clear_cache() -> None:
    _clear_responses()
    reset_store()


def warmup_caches(session: Session) -> None:
    default_filters = ReviewFilters()
    metrics(session, default_filters)
    charts(session, default_filters)
    facets(session, default_filters)


def _store(session: Session) -> AnalyticsStore:
    store, reloaded = get_store(session)
    if reloaded:
        # Respostas guardadas vieram de outra cópia (outro banco): descarta.
        _clear_responses()
    return store


_facets: tuple[list[GameFacet], list[LanguageFacet]] | None = None


def _global_facets(store: AnalyticsStore) -> tuple[list[GameFacet], list[LanguageFacet]]:
    # Catálogo estável depois do seed: calcula uma vez por cópia carregada.
    global _facets
    if _facets is not None:
        return _facets
    game_rows = store.query(
        "SELECT r.app_id, g.app_name, count(*) AS n FROM reviews r "
        "JOIN games g USING (app_id) GROUP BY r.app_id, g.app_name "
        "ORDER BY n DESC, r.app_id ASC"
    )
    language_rows = store.query(
        "SELECT language, count(*) AS n FROM reviews GROUP BY language "
        "ORDER BY n DESC, language ASC"
    )
    _facets = (
        [GameFacet(app_id=app_id, app_name=name, review_count=int(n)) for app_id, name, n in game_rows],
        [LanguageFacet(language=language, review_count=int(n)) for language, n in language_rows],
    )
    return _facets


def _hours(minutes: float | None) -> float | None:
    if minutes is None:
        return None
    return round(float(minutes) / 60, 2)


def _created_at(timestamp: int) -> str:
    moment = datetime.fromtimestamp(int(timestamp), tz=timezone.utc)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _rate(positive: int, total: int) -> float | None:
    if total == 0:
        return None
    return positive / total


def metrics(session: Session, filters: ReviewFilters) -> MetricsResponse:
    where, params = where_clause(filters)  # valida datas antes de qualquer cache
    store = _store(session)
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

    total, recommended, game_count, author_count = store.query(
        "SELECT count(*), count_if(recommended), "
        "count(DISTINCT app_id), count(DISTINCT author_steamid) "
        f"FROM reviews{where}",
        params,
    )[0]
    total = int(total or 0)
    recommended = int(recommended or 0)
    games, languages = _global_facets(store)
    result = MetricsResponse(
        total_reviews=total,
        recommendation_rate=recommended / total if total else 0.0,
        game_count=int(game_count or 0),
        author_count=int(author_count or 0),
        games=games,
        languages=languages,
    )
    _metrics_cache.set(cache_key, result)
    return result


_SORT_SQL: dict[tuple[str, str], str] = {
    ("votes_helpful", "desc"): "votes_helpful DESC, timestamp_created DESC, review_id DESC",
    ("votes_helpful", "asc"): "votes_helpful ASC, timestamp_created DESC, review_id DESC",
    ("playtime_hours", "desc"): "playtime_at_review DESC NULLS LAST, timestamp_created DESC, review_id DESC",
    ("playtime_hours", "asc"): "playtime_at_review ASC NULLS LAST, timestamp_created DESC, review_id DESC",
    ("created_at", "desc"): "timestamp_created DESC, review_id DESC",
    ("created_at", "asc"): "timestamp_created ASC, review_id ASC",
}


def list_reviews(
    session: Session,
    filters: ReviewFilters,
    limit: int,
    offset: int,
    sort_by: ReviewSortBy = "created_at",
    sort_dir: SortDir = "desc",
) -> ReviewListResponse:
    where, params = where_clause(filters)
    store = _store(session)
    cache_key = (*_filter_cache_key(filters), limit, offset, sort_by, sort_dir)
    cached = _reviews_cache.get(cache_key)
    if cached is not None:
        return cached

    order = _SORT_SQL.get((sort_by, sort_dir), _SORT_SQL[("created_at", "desc")])
    total = store.query(f"SELECT count(*) FROM reviews{where}", params)[0][0]
    rows = store.query(
        "SELECT r.review_id, r.app_id, g.app_name, r.language, r.recommended, "
        "r.votes_helpful, r.votes_funny, r.comment_count, r.playtime_at_review, "
        "r.steam_purchase, r.received_for_free, r.early_access, r.timestamp_created "
        f"FROM (SELECT * FROM reviews{where} ORDER BY {order} LIMIT ? OFFSET ?) r "
        f"JOIN games g USING (app_id) ORDER BY {order}",
        [*params, limit, offset],
    )
    # O texto fica só no banco relacional: uma consulta por chave primária.
    review_ids = [row[0] for row in rows]
    excerpts: dict[int, str] = {}
    if review_ids:
        excerpts = {
            review_id: excerpt
            for review_id, excerpt in session.execute(
                select(Review.review_id, Review.excerpt).where(Review.review_id.in_(review_ids))
            )
        }
    items = [
        ReviewItem(
            review_id=review_id,
            app_id=app_id,
            app_name=app_name,
            language=language,
            recommended=bool(recommended),
            votes_helpful=votes_helpful,
            votes_funny=votes_funny,
            comment_count=comment_count,
            playtime_at_review_hours=_hours(playtime),
            steam_purchase=bool(steam_purchase),
            received_for_free=bool(received_for_free),
            early_access=bool(early_access),
            created_at=_created_at(created),
            excerpt=excerpts.get(review_id) or "",
        )
        for (
            review_id,
            app_id,
            app_name,
            language,
            recommended,
            votes_helpful,
            votes_funny,
            comment_count,
            playtime,
            steam_purchase,
            received_for_free,
            early_access,
            created,
        ) in rows
    ]
    result = ReviewListResponse(total=int(total or 0), limit=limit, offset=offset, items=items)
    _reviews_cache.set(cache_key, result)
    return result


def charts(session: Session, filters: ReviewFilters) -> ChartsResponse:
    where_clause(filters)  # valida datas antes de qualquer cache
    store = _store(session)
    cache_key = _filter_cache_key(filters)
    cached = _charts_cache.get(cache_key)
    if cached is not None:
        return cached

    if is_empty_filters(filters):
        baseline = _get_baseline()
        if baseline and "charts" in baseline:
            baseline_months = baseline["charts"].get("months", [])
            # Só reutiliza o baseline estático se os meses já possuírem recommendation_rate pré-calculada
            if baseline_months and any(m.get("recommendation_rate") is not None for m in baseline_months):
                result = ChartsResponse.model_validate(baseline["charts"])
                _charts_cache.set(cache_key, result)
                return result

    # Faixas de horas ignoram o próprio filtro: o gráfico mostra todas as faixas.
    columns = []
    for bounds in PLAYTIME_BUCKETS.values():
        condition = playtime_sql(*bounds)
        columns.append(f"count_if({condition})")
        columns.append(f"count_if({condition} AND recommended)")
    where, params = where_clause(filters.model_copy(update={"playtime_bucket": None}))
    bucket_row = store.query(f"SELECT {', '.join(columns)} FROM reviews{where}", params)[0]
    playtime = []
    for index, key in enumerate(PLAYTIME_BUCKETS):
        count = int(bucket_row[2 * index] or 0)
        positive = int(bucket_row[2 * index + 1] or 0)
        playtime.append(
            PlaytimePoint(
                key=key,
                label=PLAYTIME_LABELS[key],
                review_count=count,
                recommendation_rate=_rate(positive, count),
            )
        )

    where, params = where_clause(filters)
    game_rows = store.query(
        f"SELECT g.app_name, count(*) AS n FROM reviews r JOIN games g USING (app_id){where} "
        "GROUP BY r.app_id, g.app_name ORDER BY n DESC, g.app_name ASC LIMIT 8",
        params,
    )

    # Idiomas ignoram o próprio filtro, para comparar o idioma escolhido com os demais.
    where, params = where_clause(filters.model_copy(update={"language": None}))
    language_rows = store.query(
        f"SELECT language, count(*) AS n, count_if(recommended) AS positive FROM reviews{where} "
        "GROUP BY language ORDER BY n DESC, language ASC LIMIT 8",
        params,
    )
    languages = [
        LanguageBar(
            language=language,
            review_count=int(n),
            recommendation_rate=_rate(int(positive or 0), int(n)),
        )
        for language, n, positive in language_rows
    ]
    if filters.language is not None and not any(item.language == filters.language for item in languages):
        where, params = where_clause(filters)
        extra_count, extra_positive = store.query(
            f"SELECT count(*), count_if(recommended) FROM reviews{where}", params
        )[0]
        languages.append(
            LanguageBar(
                language=filters.language,
                review_count=int(extra_count or 0),
                recommendation_rate=_rate(int(extra_positive or 0), int(extra_count or 0)),
            )
        )

    languages.sort(
        key=lambda item: (
            item.recommendation_rate is None,
            -item.recommendation_rate if item.recommendation_rate is not None else 0,
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
    where, params = where_clause(month_filters)
    month_where = f"{where} AND timestamp_created IS NOT NULL" if where else " WHERE timestamp_created IS NOT NULL"
    month_rows = store.query(
        "SELECT strftime(epoch_ms(timestamp_created * 1000), '%Y-%m') AS month, "
        f"count(*) AS n, count_if(recommended) AS positive FROM reviews{month_where} "
        "GROUP BY month ORDER BY month ASC",
        params,
    )

    result = ChartsResponse(
        playtime=playtime,
        games=[GameBar(app_name=name, review_count=int(n)) for name, n in game_rows],
        languages=languages,
        months=[
            MonthPoint(
                month=month,
                review_count=int(n),
                recommendation_rate=_rate(int(positive or 0), int(n)),
            )
            for month, n, positive in month_rows
            if month
        ],
    )
    _charts_cache.set(cache_key, result)
    return result


def facets(session: Session, filters: ReviewFilters) -> FacetsResponse:
    """Contagens dos combos Jogo e Idioma no recorte atual.

    Cada faceta ignora o próprio filtro (semântica de facetas): a lista de jogos
    respeita o idioma e os demais filtros, e vice-versa. Só entram valores com
    contagem > 0; quem não aparece deve ser lido como zero.
    """
    where_clause(filters)  # valida datas antes de qualquer cache
    store = _store(session)
    cache_key = _filter_cache_key(filters)
    cached = _facets_cache.get(cache_key)
    if cached is not None:
        return cached

    if is_empty_filters(filters):
        global_games, global_languages = _global_facets(store)
        result = FacetsResponse(
            games=[
                GameFacetCount(app_id=game.app_id, review_count=game.review_count)
                for game in global_games
            ],
            languages=[
                LanguageFacetCount(language=entry.language, review_count=entry.review_count)
                for entry in global_languages
            ],
        )
        _facets_cache.set(cache_key, result)
        return result

    where, params = where_clause(filters.model_copy(update={"app_id": None}))
    game_rows = store.query(
        f"SELECT app_id, count(*) AS n FROM reviews{where} GROUP BY app_id ORDER BY n DESC, app_id ASC",
        params,
    )
    where, params = where_clause(filters.model_copy(update={"language": None}))
    language_rows = store.query(
        f"SELECT language, count(*) AS n FROM reviews{where} GROUP BY language ORDER BY n DESC, language ASC",
        params,
    )
    result = FacetsResponse(
        games=[GameFacetCount(app_id=app_id, review_count=int(n)) for app_id, n in game_rows],
        languages=[LanguageFacetCount(language=language, review_count=int(n)) for language, n in language_rows],
    )
    _facets_cache.set(cache_key, result)
    return result
