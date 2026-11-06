#!/usr/bin/env python3
"""
Script de migração de dados do SQLite local (backend/data/reviews.db)
para o PostgreSQL de destino (Supabase / Render).

Uso:
    uv run python scripts/migrate_sqlite_to_pg.py --target-url postgresql://user:pass@host:5432/postgres
    ou definindo TARGET_DATABASE_URL / DATABASE_URL no ambiente.
"""

from __future__ import annotations

import argparse
import os
import sqlite3
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.models import Base, Review

DEFAULT_SQLITE_PATH = REPO_ROOT / "backend" / "data" / "reviews.db"
DEFAULT_BATCH_SIZE = 5000

BOOL_COLUMNS = {
    "recommended",
    "steam_purchase",
    "received_for_free",
    "early_access",
}


def sanitize_db_url(url: str) -> str:
    url = url.strip()
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    return url


def transform_sqlite_row(row_dict: dict) -> dict:
    item = dict(row_dict)
    for col in BOOL_COLUMNS:
        val = item.get(col)
        if val is not None:
            item[col] = bool(val)
    return item


def migrate(
    target_url: str,
    sqlite_path: Path,
    batch_size: int = DEFAULT_BATCH_SIZE,
    limit: int | None = None,
    drop_existing: bool = False,
) -> int:
    target_url = sanitize_db_url(target_url)

    if not sqlite_path.exists():
        raise FileNotFoundError(f"Arquivo SQLite não encontrado: {sqlite_path}")

    print("=" * 60)
    print("MIGRAÇÃO SQLITE -> POSTGRESQL")
    print("=" * 60)
    print(f"Origem SQLite:     {sqlite_path}")
    masked_url = target_url.split("@")[-1] if "@" in target_url else target_url
    print(f"Destino:           ...@{masked_url}")
    print(f"Tamanho do lote:   {batch_size}")
    if limit:
        print(f"Limite:            {limit} registros")
    print("=" * 60)

    # 1. Conectar ao SQLite e obter contagem total
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    total_in_sqlite = sqlite_cursor.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]
    total_to_migrate = min(total_in_sqlite, limit) if limit is not None else total_in_sqlite
    print(f"Registros disponíveis no SQLite: {total_in_sqlite:,}")
    print(f"Registros a migrar:              {total_to_migrate:,}")

    if total_to_migrate == 0:
        print("Nenhum registro para migrar.")
        sqlite_conn.close()
        return 0

    # 2. Conectar ao PostgreSQL e criar schema
    print("\nConectando ao banco de destino...")
    pg_engine = create_engine(target_url, pool_pre_ping=True)

    if drop_existing:
        print("Opção --drop-existing ativa: apagando tabelas existentes...")
        Base.metadata.drop_all(bind=pg_engine)

    print("Garantindo estrutura de tabelas e índices no destino...")
    Base.metadata.create_all(bind=pg_engine)
    print("Tabelas e índices verificados com sucesso.")

    # 3. Ler do SQLite e inserir em lotes
    query = "SELECT * FROM reviews"
    if limit is not None:
        query += f" LIMIT {limit}"
    sqlite_cursor.execute(query)

    migrated = 0
    start_time = time.perf_counter()
    last_log_time = start_time

    print("\nIniciando transferência em lotes...")

    with Session(pg_engine) as session:
        while True:
            rows = sqlite_cursor.fetchmany(batch_size)
            if not rows:
                break

            batch = [transform_sqlite_row(dict(r)) for r in rows]
            session.bulk_insert_mappings(Review, batch)
            session.commit()

            migrated += len(batch)
            now = time.perf_counter()

            # Log a cada lote ou a cada ~2 segundos
            if (now - last_log_time >= 2.0) or (migrated == total_to_migrate) or (migrated % (batch_size * 5) == 0):
                elapsed = now - start_time
                pct = (migrated / total_to_migrate) * 100 if total_to_migrate else 100.0
                rate = migrated / elapsed if elapsed > 0 else 0
                eta = (total_to_migrate - migrated) / rate if rate > 0 else 0
                print(
                    f"[{pct:5.1f}%] {migrated:,} / {total_to_migrate:,} registros "
                    f"({rate:,.0f} reg/s | decorrido: {elapsed:.1f}s | restante: ~{eta:.1f}s)",
                    flush=True,
                )
                last_log_time = now

    sqlite_conn.close()
    pg_engine.dispose()

    total_time = time.perf_counter() - start_time
    print("=" * 60)
    print(f"MIGRAÇÃO CONCLUÍDA: {migrated:,} registros migrados em {total_time:.2f}s.")
    print("=" * 60)
    return migrated


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migra dados do SQLite local (reviews.db) para o PostgreSQL (Supabase/Render)."
    )
    parser.add_argument(
        "--target-url",
        dest="target_url",
        default=None,
        help="URL de conexão PostgreSQL. Se omitido, lê TARGET_DATABASE_URL ou DATABASE_URL.",
    )
    parser.add_argument(
        "--sqlite-path",
        dest="sqlite_path",
        type=Path,
        default=DEFAULT_SQLITE_PATH,
        help=f"Caminho do arquivo SQLite (padrão: {DEFAULT_SQLITE_PATH}).",
    )
    parser.add_argument(
        "--batch-size",
        dest="batch_size",
        type=int,
        default=DEFAULT_BATCH_SIZE,
        help=f"Tamanho do lote de inserção (padrão: {DEFAULT_BATCH_SIZE}).",
    )
    parser.add_argument(
        "--limit",
        dest="limit",
        type=int,
        default=None,
        help="Limite de registros a migrar (opcional, útil para testes).",
    )
    parser.add_argument(
        "--drop-existing",
        dest="drop_existing",
        action="store_true",
        help="Apaga tabelas existentes antes de criar o schema.",
    )

    args = parser.parse_args()

    target_url = (
        args.target_url
        or os.getenv("TARGET_DATABASE_URL")
        or os.getenv("DATABASE_URL")
    )

    if not target_url:
        parser.error(
            "URL de destino não informada. Passe via --target-url ou "
            "defina TARGET_DATABASE_URL ou DATABASE_URL no ambiente."
        )

    try:
        migrate(
            target_url=target_url,
            sqlite_path=args.sqlite_path,
            batch_size=args.batch_size,
            limit=args.limit,
            drop_existing=args.drop_existing,
        )
    except Exception as exc:
        print(f"\nErro fatal durante a migração: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
