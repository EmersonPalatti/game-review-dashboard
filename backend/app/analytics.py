"""Cópia colunar das avaliações em memória (DuckDB) para as agregações do painel.

O acervo é estático depois do seed. Agregar 1 milhão de linhas no Postgres Nano
do Supabase leva de 10 a 60 s por filtro novo; no DuckDB em memória, milissegundos.
O texto (`excerpt`) continua só no banco relacional e é buscado por chave primária.

Fontes da cópia:
- Engine de produção (`database.engine`) com `reviews.parquet` presente: lê o Parquet.
- Qualquer outra engine (testes, banco sem snapshot): lê as linhas pela sessão.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any

import duckdb
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from backend.app.models import Review
from backend.app.schemas import ReviewFilters
from backend.app.transform import PLAYTIME_BUCKETS

logger = logging.getLogger(__name__)

PARQUET_PATH = Path(
    os.getenv("ANALYTICS_PARQUET", Path(__file__).resolve().parent / "reviews.parquet")
)

# Ordem e tipos das colunas do Parquet e da tabela em memória.
# `app_name` fica fora da tabela de fatos: vai para `games` (59 linhas).
SNAPSHOT_COLUMNS: dict[str, str] = {
    "review_id": "BIGINT",
    "app_id": "INTEGER",
    "app_name": "VARCHAR",
    "language": "VARCHAR",
    "recommended": "BOOLEAN",
    "votes_helpful": "INTEGER",
    "votes_funny": "BIGINT",
    "comment_count": "INTEGER",
    "timestamp_created": "BIGINT",
    "author_steamid": "BIGINT",
    "playtime_at_review": "DOUBLE",
    "steam_purchase": "BOOLEAN",
    "received_for_free": "BOOLEAN",
    "early_access": "BOOLEAN",
}
FACT_COLUMNS = [name for name in SNAPSHOT_COLUMNS if name != "app_name"]

DATE_ERROR = "Data inválida. Use o formato AAAA-MM-DD."


def date_bounds(filters: ReviewFilters) -> tuple[int | None, int | None]:
    """Converte date_from/date_to (dias UTC inclusivos) em epoch segundos."""

    def parse(value: str, end_of_day: bool) -> int:
        try:
            moment = datetime.strptime(value, "%Y-%m-%d")
        except ValueError as err:
            raise HTTPException(status_code=422, detail=DATE_ERROR) from err
        if end_of_day:
            moment = moment.replace(hour=23, minute=59, second=59)
        return int(moment.replace(tzinfo=timezone.utc).timestamp())

    ts_from = parse(filters.date_from, False) if filters.date_from is not None else None
    ts_to = parse(filters.date_to, True) if filters.date_to is not None else None
    return ts_from, ts_to


def playtime_sql(low: int | None, high: int | None) -> str:
    parts = ["playtime_at_review IS NOT NULL"]
    if low is not None:
        parts.append(f"playtime_at_review >= {int(low)}")
    if high is not None:
        parts.append(f"playtime_at_review < {int(high)}")
    return " AND ".join(parts)


def where_clause(filters: ReviewFilters) -> tuple[str, list[Any]]:
    """WHERE parametrizado equivalente ao `apply_filters` do SQLAlchemy."""
    parts: list[str] = []
    params: list[Any] = []
    for column in ("app_id", "language", "recommended", "steam_purchase", "received_for_free", "early_access"):
        value = getattr(filters, column)
        if value is not None:
            parts.append(f"{column} = ?")
            params.append(value)
    if filters.playtime_bucket is not None:
        parts.append(playtime_sql(*PLAYTIME_BUCKETS[filters.playtime_bucket]))
    ts_from, ts_to = date_bounds(filters)
    if ts_from is not None:
        parts.append("timestamp_created >= ?")
        params.append(ts_from)
    if ts_to is not None:
        parts.append("timestamp_created <= ?")
        params.append(ts_to)
    sql = " WHERE " + " AND ".join(parts) if parts else ""
    return sql, params


class AnalyticsStore:
    def __init__(self, connection: duckdb.DuckDBPyConnection, source: str) -> None:
        self._connection = connection
        self.source = source

    def query(self, sql: str, params: list[Any] | None = None) -> list[tuple]:
        # Um cursor por chamada: o FastAPI roda rotas síncronas em várias threads.
        cursor = self._connection.cursor()
        try:
            return cursor.execute(sql, params or []).fetchall()
        finally:
            cursor.close()

    def close(self) -> None:
        self._connection.close()


def _new_connection() -> duckdb.DuckDBPyConnection:
    connection = duckdb.connect(":memory:")
    # O Render free tem 0,1 vCPU e 512 MB: mais threads só disputam a CPU.
    connection.execute(f"SET threads = {int(os.getenv('ANALYTICS_THREADS', '1'))}")
    connection.execute(f"SET memory_limit = '{os.getenv('ANALYTICS_MEMORY_LIMIT', '200MB')}'")
    connection.execute("SET preserve_insertion_order = false")
    return connection


def _create_tables_from_snapshot(connection: duckdb.DuckDBPyConnection) -> None:
    facts = ", ".join(FACT_COLUMNS)
    connection.execute(f"CREATE TABLE reviews AS SELECT {facts} FROM snapshot")
    connection.execute(
        "CREATE TABLE games AS SELECT app_id, min(app_name) AS app_name FROM snapshot GROUP BY app_id"
    )


def _load_parquet(path: Path) -> AnalyticsStore:
    connection = _new_connection()
    escaped = path.as_posix().replace("'", "''")
    connection.execute(f"CREATE TEMP VIEW snapshot AS SELECT * FROM read_parquet('{escaped}')")
    _create_tables_from_snapshot(connection)
    connection.execute("DROP VIEW snapshot")
    return AnalyticsStore(connection, source=f"parquet:{path.name}")


def _load_session(session: Session) -> AnalyticsStore:
    connection = _new_connection()
    columns_ddl = ", ".join(f"{name} {kind}" for name, kind in SNAPSHOT_COLUMNS.items())
    connection.execute(f"CREATE TEMP TABLE snapshot ({columns_ddl})")
    placeholders = ", ".join("?" for _ in SNAPSHOT_COLUMNS)
    selected = [getattr(Review, name) for name in SNAPSHOT_COLUMNS]
    result = session.execute(select(*selected)).yield_per(10_000)
    for batch in result.partitions():
        connection.executemany(
            f"INSERT INTO snapshot VALUES ({placeholders})",
            [tuple(row) for row in batch],
        )
    _create_tables_from_snapshot(connection)
    connection.execute("DROP TABLE snapshot")
    return AnalyticsStore(connection, source="session")


_store: AnalyticsStore | None = None
_store_bind: Engine | None = None
_store_lock = Lock()


def _production_engine() -> Engine:
    from backend.app.database import engine

    return engine


def get_store(session: Session) -> tuple[AnalyticsStore, bool]:
    """Devolve a cópia em memória da engine da sessão e se ela acabou de ser recriada."""
    global _store, _store_bind
    bind = session.get_bind()
    with _store_lock:
        if _store is not None and _store_bind is bind:
            return _store, False
        if _store is not None:
            _store.close()
        if bind is _production_engine() and PARQUET_PATH.is_file():
            store = _load_parquet(PARQUET_PATH)
        else:
            if bind is _production_engine():
                logger.warning(
                    "Snapshot %s ausente; carregando as avaliações pelo banco (lento).",
                    PARQUET_PATH,
                )
            store = _load_session(session)
        _store, _store_bind = store, bind
        logger.info("Cópia analítica carregada de %s", store.source)
        return store, True


def reset_store() -> None:
    global _store, _store_bind
    with _store_lock:
        if _store is not None:
            _store.close()
        _store, _store_bind = None, None
