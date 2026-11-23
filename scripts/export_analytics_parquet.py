"""Gera backend/app/reviews.parquet, a cópia colunar que a API carrega no DuckDB.

Rode de novo sempre que o acervo do banco mudar (novo seed ou migração).

    uv run python scripts/export_analytics_parquet.py                 # SQLite local
    uv run python scripts/export_analytics_parquet.py --source-url postgresql://...

O DuckDB baixa a extensão `sqlite` ou `postgres` na primeira execução.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.analytics import PARQUET_PATH, SNAPSHOT_COLUMNS  # noqa: E402
from backend.app.database import DB_PATH  # noqa: E402

BASELINE_PATH = ROOT / "backend" / "app" / "baseline.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--source-url", help="URL PostgreSQL. Sem ela, lê o SQLite local.")
    parser.add_argument("--output", type=Path, default=PARQUET_PATH)
    args = parser.parse_args()

    con = duckdb.connect()
    if args.source_url:
        url = args.source_url.replace("postgresql+psycopg2://", "postgresql://", 1)
        con.execute("INSTALL postgres; LOAD postgres")
        con.execute("ATTACH ? AS src (TYPE postgres, READ_ONLY)", [url])
        table = "src.public.reviews"
    else:
        if not DB_PATH.is_file():
            sys.exit(f"SQLite não encontrado em {DB_PATH}. Rode o seed ou passe --source-url.")
        con.execute("INSTALL sqlite; LOAD sqlite")
        con.execute("ATTACH ? AS src (TYPE sqlite, READ_ONLY)", [DB_PATH.as_posix()])
        table = "src.reviews"

    columns = ", ".join(f"CAST({name} AS {kind}) AS {name}" for name, kind in SNAPSHOT_COLUMNS.items())
    output = args.output.resolve().as_posix().replace("'", "''")
    con.execute(
        f"COPY (SELECT {columns} FROM {table} ORDER BY app_id, timestamp_created) "
        f"TO '{output}' (FORMAT parquet, COMPRESSION zstd)"
    )

    total, authors = con.execute(
        f"SELECT count(*), count(DISTINCT author_steamid) FROM read_parquet('{output}')"
    ).fetchone()
    size_mb = args.output.stat().st_size / 2**20
    print(f"{args.output}: {total:,} avaliações, {authors:,} autores, {size_mb:.1f} MB")

    if BASELINE_PATH.is_file():
        baseline = json.loads(BASELINE_PATH.read_text(encoding="utf-8"))["metrics"]
        if (baseline["total_reviews"], baseline["author_count"]) != (total, authors):
            print("Aviso: baseline.json não bate com o snapshot. Regenere o baseline.")


if __name__ == "__main__":
    main()
