#!/usr/bin/env python3
"""
Constrói o índice sidecar de busca híbrida (FTS5 + sqlite-vec + FastEmbed)
sem modificar backend/data/reviews.db.

Uso:
    uv run python scripts/build_search_index.py --vec-limit 12000
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.app.database import DB_PATH
from backend.app.search_index import DEFAULT_SEARCH_INDEX_PATH, build_search_index


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera backend/data/search_index.db com FTS5 (corpus completo) e sqlite-vec (FastEmbed)."
    )
    parser.add_argument(
        "--source-db",
        type=Path,
        default=DB_PATH,
        help=f"Banco SQLite de origem (padrão: {DB_PATH}).",
    )
    parser.add_argument(
        "--target-db",
        type=Path,
        default=DEFAULT_SEARCH_INDEX_PATH,
        help=f"Arquivo do índice sidecar (padrão: {DEFAULT_SEARCH_INDEX_PATH}).",
    )
    parser.add_argument(
        "--vec-limit",
        type=int,
        default=12000,
        help="Quantidade máxima de reviews estratificadas para vetorização (padrão: 12000).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=256,
        help="Tamanho do lote de embeddings FastEmbed (padrão: 256).",
    )
    parser.add_argument(
        "--skip-vectors",
        action="store_true",
        help="Constrói apenas o índice FTS5 BM25 (sem gerar embeddings).",
    )
    args = parser.parse_args()

    print("=" * 60)
    print("CONSTRUÇÃO DO ÍNDICE HÍBRIDO (FTS5 + sqlite-vec)")
    print("=" * 60)
    print(f"Origem:  {args.source_db}")
    print(f"Destino: {args.target_db}")
    print(f"Vetores: {'desativado (--skip-vectors)' if args.skip_vectors else f'até {args.vec_limit:,}'}")
    print("=" * 60)

    summary = build_search_index(
        source_db=args.source_db,
        target_index=args.target_db,
        vec_limit=args.vec_limit,
        batch_size=args.batch_size,
        build_vectors=not args.skip_vectors,
        progress_cb=lambda msg: print(f"  {msg}", flush=True),
    )

    print("=" * 60)
    print(
        f"Índice pronto em {summary['elapsed_seconds']}s | "
        f"FTS5: {summary['fts_count']:,} | Vetores: {summary['vec_count']:,}"
    )
    print("=" * 60)


if __name__ == "__main__":
    main()
