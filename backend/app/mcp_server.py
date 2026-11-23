from __future__ import annotations

import argparse
from contextlib import asynccontextmanager, contextmanager
from contextvars import ContextVar
import json
import threading
from typing import Any, AsyncIterator, Iterator

from fastmcp import Client, FastMCP
from langchain_core.tools import BaseTool
from langchain_mcp_adapters.tools import load_mcp_tools
from sqlalchemy.orm import Session

from backend.app.analytics_ext import (
    compare_slices as compute_slice_comparison,
    get_engagement_stats as compute_engagement_stats,
    resolve_game_catalog,
)
from backend.app.database import SessionLocal
from backend.app.queries import charts, list_reviews, metrics
from backend.app.schemas import ReviewFilters, ReviewSortBy, SortDir
from backend.app.search_index import hybrid_search_reviews
from backend.app.transform import PLAYTIME_BUCKETS

_active_session: ContextVar[Session | None] = ContextVar("_active_session", default=None)
_active_session_lock: ContextVar[threading.Lock | None] = ContextVar(
    "_active_session_lock", default=None
)
_active_default_filters: ContextVar[ReviewFilters | None] = ContextVar(
    "_active_default_filters", default=None
)

mcp = FastMCP(
    "SteamReviewsAnalytics",
    instructions=(
        "Servidor MCP de análise sobre 1.000.000 de avaliações da Steam "
        "(59 jogos, mar/2013 a jan/2021). Use resolve_game antes de supor um app_id."
    ),
)


@contextmanager
def mcp_request_context(
    session: Session,
    default_filters: ReviewFilters | None = None,
) -> Iterator[None]:
    """Vincula a sessão SQLAlchemy e os filtros padrão do painel às chamadas MCP no mesmo contexto."""
    tok_session = _active_session.set(session)
    tok_lock = _active_session_lock.set(threading.Lock())
    tok_filters = _active_default_filters.set(default_filters or ReviewFilters())
    try:
        yield
    finally:
        _active_default_filters.reset(tok_filters)
        _active_session_lock.reset(tok_lock)
        _active_session.reset(tok_session)


@contextmanager
def _resolve_session() -> Iterator[Session]:
    bound = _active_session.get()
    if bound is not None:
        lock = _active_session_lock.get()
        if lock is not None:
            with lock:
                yield bound
        else:
            yield bound
        return
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _merge_filters(
    default: ReviewFilters | None,
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> ReviewFilters:
    base = default or ReviewFilters()
    chosen_bucket = playtime_bucket if playtime_bucket is not None else base.playtime_bucket
    if chosen_bucket is not None and chosen_bucket not in PLAYTIME_BUCKETS:
        chosen_bucket = base.playtime_bucket

    return ReviewFilters(
        app_id=app_id if app_id is not None else base.app_id,
        language=language if language is not None else base.language,
        recommended=recommended if recommended is not None else base.recommended,
        steam_purchase=steam_purchase if steam_purchase is not None else base.steam_purchase,
        received_for_free=(
            received_for_free if received_for_free is not None else base.received_for_free
        ),
        early_access=early_access if early_access is not None else base.early_access,
        playtime_bucket=chosen_bucket,
        date_from=date_from if date_from is not None else base.date_from,
        date_to=date_to if date_to is not None else base.date_to,
    )


def _dump(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False)


@mcp.tool()
def resolve_game(query: str | None = None, limit: int = 20) -> str:
    """Lista ou busca jogos e idiomas no catálogo completo (59 jogos e todos os idiomas).
    Use antes de filtrar por app_id quando o usuário citar um jogo pelo nome.
    Se query for omitido, retorna os jogos e idiomas disponíveis."""
    with _resolve_session() as session:
        return _dump(resolve_game_catalog(session, query=query, limit=limit))


@mcp.tool()
def get_metrics(
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    """Obtém métricas agregadas do recorte: total de reviews, taxa de recomendação, jogos e autores únicos, top 10 jogos e top 10 idiomas."""
    with _resolve_session() as session:
        eff = _merge_filters(
            _active_default_filters.get(),
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=playtime_bucket,
            date_from=date_from,
            date_to=date_to,
        )
        res = metrics(session, eff)
        return _dump(
            {
                "total_reviews": res.total_reviews,
                "recommendation_rate": res.recommendation_rate,
                "game_count": res.game_count,
                "author_count": res.author_count,
                "games": [g.model_dump() for g in res.games[:10]],
                "languages": [l.model_dump() for l in res.languages[:10]],
                "applied_filters": eff.model_dump(exclude_none=True),
            }
        )


@mcp.tool()
def get_charts(
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    """Obtém distribuição por faixa de horas jogadas (playtime), top jogos, comparação por idiomas e evolução mensal."""
    with _resolve_session() as session:
        eff = _merge_filters(
            _active_default_filters.get(),
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=playtime_bucket,
            date_from=date_from,
            date_to=date_to,
        )
        res = charts(session, eff)
        months_dump = [m.model_dump() for m in res.months]
        if len(months_dump) > 24:
            peak = max(months_dump, key=lambda m: m["review_count"])
            compact_months: Any = {
                "total_months": len(months_dump),
                "peak_month": peak,
                "first_months": months_dump[:6],
                "recent_months": months_dump[-12:],
            }
        else:
            compact_months = months_dump
        return _dump(
            {
                "playtime": [p.model_dump() for p in res.playtime],
                "games": [g.model_dump() for g in res.games[:10]],
                "languages": [l.model_dump() for l in res.languages[:10]],
                "languages_note": "languages ignora o filtro de idioma: compara os idiomas sob os demais filtros",
                "months": compact_months,
                "applied_filters": eff.model_dump(exclude_none=True),
            }
        )


@mcp.tool()
def get_reviews_sample(
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 5,
    sort_by: ReviewSortBy = "votes_helpful",
    sort_dir: SortDir = "desc",
) -> str:
    """Obtém amostra de avaliações individuais ordenadas por votos úteis, data ou horas jogadas."""
    with _resolve_session() as session:
        eff = _merge_filters(
            _active_default_filters.get(),
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=playtime_bucket,
            date_from=date_from,
            date_to=date_to,
        )
        clamped_limit = max(1, min(10, limit if isinstance(limit, int) else 5))
        valid_sort_by: ReviewSortBy = (
            sort_by if sort_by in ("votes_helpful", "created_at", "playtime_hours") else "votes_helpful"
        )
        valid_sort_dir: SortDir = sort_dir if sort_dir in ("asc", "desc") else "desc"
        res = list_reviews(
            session,
            eff,
            limit=clamped_limit,
            offset=0,
            sort_by=valid_sort_by,
            sort_dir=valid_sort_dir,
        )
        return _dump(
            {
                "total": res.total,
                "limit": res.limit,
                "items": [item.model_dump() for item in res.items],
                "applied_filters": eff.model_dump(exclude_none=True),
            }
        )


@mcp.tool()
def get_engagement_stats(
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> str:
    """Calcula média/máximo de votos úteis, votos engraçados, comentários, horas jogadas e tamanho do texto, comparando positivas vs negativas."""
    with _resolve_session() as session:
        eff = _merge_filters(
            _active_default_filters.get(),
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=playtime_bucket,
            date_from=date_from,
            date_to=date_to,
        )
        return _dump(compute_engagement_stats(session, eff))


@mcp.tool()
def compare_slices(
    label_a: str,
    label_b: str,
    app_id_a: int | None = None,
    language_a: str | None = None,
    recommended_a: bool | None = None,
    early_access_a: bool | None = None,
    playtime_bucket_a: str | None = None,
    date_from_a: str | None = None,
    date_to_a: str | None = None,
    app_id_b: int | None = None,
    language_b: str | None = None,
    recommended_b: bool | None = None,
    early_access_b: bool | None = None,
    playtime_bucket_b: str | None = None,
    date_from_b: str | None = None,
    date_to_b: str | None = None,
) -> str:
    """Compara dois recortes A e B em uma única chamada (volume, aprovação, delta em p.p., votos úteis e horas médias)."""
    with _resolve_session() as session:
        base = _active_default_filters.get() or ReviewFilters()
        filters_a = _merge_filters(
            base,
            app_id=app_id_a,
            language=language_a,
            recommended=recommended_a,
            early_access=early_access_a,
            playtime_bucket=playtime_bucket_a,
            date_from=date_from_a,
            date_to=date_to_a,
        )
        filters_b = _merge_filters(
            base,
            app_id=app_id_b,
            language=language_b,
            recommended=recommended_b,
            early_access=early_access_b,
            playtime_bucket=playtime_bucket_b,
            date_from=date_from_b,
            date_to=date_to_b,
        )
        return _dump(compute_slice_comparison(session, label_a, filters_a, label_b, filters_b))


@mcp.tool()
def search_reviews_hybrid(
    query: str,
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 8,
) -> str:
    """Busca híbrida (FTS5 BM25 + busca semântica vetorial) dentro do texto das reviews para investigar reclamações, elogios, bugs, DLCs ou temas."""
    with _resolve_session() as session:
        eff = _merge_filters(
            _active_default_filters.get(),
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=playtime_bucket,
            date_from=date_from,
            date_to=date_to,
        )
        return _dump(hybrid_search_reviews(session, query=query, filters=eff, limit=limit))


@asynccontextmanager
async def steam_mcp_tools(
    session: Session,
    default_filters: ReviewFilters | None = None,
) -> AsyncIterator[list[BaseTool]]:
    """Carrega as 7 ferramentas MCP do SteamReviewsAnalytics via cliente FastMCP in-memory."""
    with mcp_request_context(session, default_filters):
        async with Client(mcp) as client:
            tools = await load_mcp_tools(client.session)
            yield tools


def main() -> None:
    parser = argparse.ArgumentParser(description="Servidor MCP SteamReviewsAnalytics (FastMCP).")
    parser.add_argument(
        "--transport",
        choices=("stdio", "streamable-http"),
        default="stdio",
        help="Transporte MCP (padrão: stdio).",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()

    if args.transport == "streamable-http":
        mcp.run(transport="streamable-http", host=args.host, port=args.port)
    else:
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
