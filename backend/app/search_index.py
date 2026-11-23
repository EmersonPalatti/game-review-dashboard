from __future__ import annotations

import logging
import os
import re
import sqlite3
import struct
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from backend.app.models import Review
from backend.app.queries import _created_at, _hours, apply_filters
from backend.app.schemas import ReviewFilters
from backend.app.transform import PLAYTIME_BUCKETS

logger = logging.getLogger(__name__)

DEFAULT_SEARCH_INDEX_PATH = Path(__file__).resolve().parents[2] / "backend" / "data" / "search_index.db"
EMBEDDING_MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
EMBEDDING_DIM = 384

_TOKEN_RE = re.compile(r"[^\W_]+", re.UNICODE)
_embedder_lock = threading.Lock()
_embedder_instance: Any | None = None
_embedder_failed = False


def _get_embedder() -> Any | None:
    """Inicializa lazily o modelo FastEmbed multilíngue em CPU."""
    global _embedder_instance, _embedder_failed
    if _embedder_failed:
        return None
    if _embedder_instance is not None:
        return _embedder_instance
    with _embedder_lock:
        if _embedder_instance is not None:
            return _embedder_instance
        if _embedder_failed:
            return None
        try:
            from fastembed import TextEmbedding

            _embedder_instance = TextEmbedding(model_name=EMBEDDING_MODEL_NAME)
            return _embedder_instance
        except Exception as err:
            logger.warning("FastEmbed indisponível; usando FTS5 sem vetorização: %s", err)
            _embedder_failed = True
            return None


def _extract_tokens(raw_query: str) -> list[str]:
    tokens = [tok.lower() for tok in _TOKEN_RE.findall(raw_query or "")]
    filtered = [tok for tok in tokens if len(tok) >= 2]
    return filtered if filtered else tokens


def _sanitize_fts_query(raw_query: str, operator: str = "AND") -> str:
    tokens = _extract_tokens(raw_query)
    if not tokens:
        return ""
    quoted = [f'"{tok}"*' for tok in tokens[:8]]
    joiner = f" {operator} "
    return joiner.join(quoted)


def _serialize_f32(vector: Any) -> bytes:
    floats = [float(x) for x in vector]
    return struct.pack(f"{len(floats)}f", *floats)


def _build_meta_where(filters: ReviewFilters, alias: str = "") -> tuple[str, list[Any]]:
    prefix = f"{alias}." if alias else ""
    clauses: list[str] = []
    params: list[Any] = []

    if filters.app_id is not None:
        clauses.append(f"{prefix}app_id = ?")
        params.append(int(filters.app_id))
    if filters.language is not None:
        clauses.append(f"{prefix}language = ?")
        params.append(filters.language)
    if filters.recommended is not None:
        clauses.append(f"{prefix}recommended = ?")
        params.append(1 if filters.recommended else 0)
    if filters.steam_purchase is not None:
        clauses.append(f"{prefix}steam_purchase = ?")
        params.append(1 if filters.steam_purchase else 0)
    if filters.received_for_free is not None:
        clauses.append(f"{prefix}received_for_free = ?")
        params.append(1 if filters.received_for_free else 0)
    if filters.early_access is not None:
        clauses.append(f"{prefix}early_access = ?")
        params.append(1 if filters.early_access else 0)
    if filters.playtime_bucket is not None and filters.playtime_bucket in PLAYTIME_BUCKETS:
        low, high = PLAYTIME_BUCKETS[filters.playtime_bucket]
        clauses.append(f"{prefix}playtime_at_review IS NOT NULL")
        if low is not None:
            clauses.append(f"{prefix}playtime_at_review >= ?")
            params.append(float(low))
        if high is not None:
            clauses.append(f"{prefix}playtime_at_review < ?")
            params.append(float(high))
    if filters.date_from is not None:
        ts_from = int(
            datetime.strptime(filters.date_from, "%Y-%m-%d")
            .replace(tzinfo=timezone.utc)
            .timestamp()
        )
        clauses.append(f"{prefix}timestamp_created >= ?")
        params.append(ts_from)
    if filters.date_to is not None:
        ts_to = int(
            datetime.strptime(filters.date_to, "%Y-%m-%d")
            .replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            .timestamp()
        )
        clauses.append(f"{prefix}timestamp_created <= ?")
        params.append(ts_to)

    return (" AND ".join(clauses) if clauses else "1=1"), params


def _load_sqlite_vec(con: sqlite3.Connection) -> bool:
    if not hasattr(con, "enable_load_extension"):
        return False
    try:
        import sqlite_vec

        con.enable_load_extension(True)
        sqlite_vec.load(con)
        con.enable_load_extension(False)
        return True
    except Exception as err:
        logger.warning("Falha ao carregar extensão sqlite-vec: %s", err)
        return False


def build_search_index(
    source_db: Path,
    target_index: Path = DEFAULT_SEARCH_INDEX_PATH,
    vec_limit: int = 12000,
    batch_size: int = 256,
    build_vectors: bool = True,
    progress_cb: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    """Constrói índice sidecar FTS5 (corpus completo) + sqlite-vec (amostra estratificada)."""
    if not source_db.is_file():
        raise FileNotFoundError(f"Banco SQLite de origem não encontrado: {source_db}")

    def _log(msg: str) -> None:
        if progress_cb:
            progress_cb(msg)

    t0 = time.perf_counter()
    target_index.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = target_index.with_name(target_index.name + ".tmp")
    if tmp_path.exists():
        tmp_path.unlink()

    src_con = sqlite3.connect(f"file:{source_db}?mode=ro", uri=True)
    tmp_con = sqlite3.connect(tmp_path)

    vec_loaded = False
    if build_vectors:
        vec_loaded = _load_sqlite_vec(tmp_con)
        if not vec_loaded:
            raise RuntimeError("sqlite-vec não pôde ser carregado para construir o índice vetorial.")

    try:
        tmp_con.execute("PRAGMA journal_mode=OFF")
        tmp_con.execute("PRAGMA synchronous=OFF")
        tmp_con.execute("PRAGMA temp_store=MEMORY")

        tmp_con.execute(
            """
            CREATE VIRTUAL TABLE reviews_fts USING fts5(
                review_id UNINDEXED,
                app_id UNINDEXED,
                app_name UNINDEXED,
                language UNINDEXED,
                recommended UNINDEXED,
                votes_helpful UNINDEXED,
                playtime_at_review UNINDEXED,
                timestamp_created UNINDEXED,
                steam_purchase UNINDEXED,
                received_for_free UNINDEXED,
                early_access UNINDEXED,
                excerpt,
                tokenize='unicode61 remove_diacritics 2'
            )
            """
        )

        fts_count = 0
        fts_batch = 25000
        cursor = src_con.execute(
            """
            SELECT review_id, app_id, app_name, language, recommended,
                   votes_helpful, playtime_at_review, timestamp_created,
                   steam_purchase, received_for_free, early_access, excerpt
            FROM reviews
            WHERE excerpt IS NOT NULL AND excerpt != ''
            """
        )
        while True:
            rows = cursor.fetchmany(fts_batch)
            if not rows:
                break
            tmp_con.executemany(
                """
                INSERT INTO reviews_fts (
                    review_id, app_id, app_name, language, recommended,
                    votes_helpful, playtime_at_review, timestamp_created,
                    steam_purchase, received_for_free, early_access, excerpt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            fts_count += len(rows)
            _log(f"FTS5 indexado: {fts_count:,} reviews...")

        tmp_con.commit()
        _log(f"FTS5 concluído ({fts_count:,} registros em {time.perf_counter() - t0:.1f}s).")

        vec_count = 0
        if build_vectors and vec_limit > 0:
            embedder = _get_embedder()
            if embedder is None:
                raise RuntimeError("FastEmbed não disponível para gerar embeddings.")

            tmp_con.execute(
                """
                CREATE TABLE vec_meta (
                    review_id INTEGER PRIMARY KEY,
                    app_id INTEGER NOT NULL,
                    app_name TEXT NOT NULL,
                    language TEXT NOT NULL,
                    recommended INTEGER NOT NULL,
                    votes_helpful INTEGER NOT NULL,
                    playtime_at_review REAL,
                    timestamp_created INTEGER NOT NULL,
                    steam_purchase INTEGER NOT NULL,
                    received_for_free INTEGER NOT NULL,
                    early_access INTEGER NOT NULL,
                    excerpt TEXT NOT NULL
                )
                """
            )
            tmp_con.execute("CREATE INDEX ix_vec_meta_app_rec ON vec_meta(app_id, recommended)")
            tmp_con.execute("CREATE INDEX ix_vec_meta_lang ON vec_meta(language)")
            tmp_con.execute(
                f"CREATE VIRTUAL TABLE vec_reviews USING vec0(review_id INTEGER PRIMARY KEY, embedding float[{EMBEDDING_DIM}])"
            )

            app_ids = [r[0] for r in src_con.execute("SELECT DISTINCT app_id FROM reviews ORDER BY app_id").fetchall()]
            num_groups = max(1, len(app_ids) * 2)
            per_group = max(10, vec_limit // num_groups)

            selected_rows: list[tuple[Any, ...]] = []
            for aid in app_ids:
                for rec_flag in (1, 0):
                    # `+recommended` evita que o SQLite escolha ix_reviews_recommended_author em vez de ix_reviews_app_id
                    group_rows = src_con.execute(
                        """
                        SELECT review_id, app_id, app_name, language, recommended,
                               votes_helpful, playtime_at_review, timestamp_created,
                               steam_purchase, received_for_free, early_access, excerpt
                        FROM reviews
                        WHERE app_id = ? AND +recommended = ?
                          AND excerpt IS NOT NULL AND length(excerpt) >= 24
                        ORDER BY votes_helpful DESC, length(excerpt) DESC
                        LIMIT ?
                        """,
                        (aid, rec_flag, per_group),
                    ).fetchall()
                    selected_rows.extend(group_rows)

            if not selected_rows:
                selected_rows = src_con.execute(
                    """
                    SELECT review_id, app_id, app_name, language, recommended,
                           votes_helpful, playtime_at_review, timestamp_created,
                           steam_purchase, received_for_free, early_access, excerpt
                    FROM reviews
                    WHERE excerpt IS NOT NULL AND excerpt != ''
                    ORDER BY votes_helpful DESC, length(excerpt) DESC
                    LIMIT ?
                    """,
                    (vec_limit,),
                ).fetchall()

            selected_rows = selected_rows[:vec_limit]
            _log(f"Amostra estratificada selecionada: {len(selected_rows):,} reviews de {len(app_ids)} jogos.")

            t_vec = time.perf_counter()
            for start in range(0, len(selected_rows), batch_size):
                chunk = selected_rows[start : start + batch_size]
                texts = [row[11] for row in chunk]
                embeddings = list(embedder.embed(texts, batch_size=batch_size))

                tmp_con.executemany(
                    """
                    INSERT OR IGNORE INTO vec_meta (
                        review_id, app_id, app_name, language, recommended,
                        votes_helpful, playtime_at_review, timestamp_created,
                        steam_purchase, received_for_free, early_access, excerpt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    chunk,
                )
                tmp_con.executemany(
                    "INSERT OR IGNORE INTO vec_reviews (review_id, embedding) VALUES (?, ?)",
                    [(int(row[0]), _serialize_f32(vec)) for row, vec in zip(chunk, embeddings)],
                )
                vec_count += len(chunk)
                if vec_count % (batch_size * 8) == 0 or vec_count == len(selected_rows):
                    _log(f"Embeddings vetoriais: {vec_count:,} / {len(selected_rows):,}...")

            tmp_con.commit()
            _log(f"sqlite-vec concluído ({vec_count:,} vetores em {time.perf_counter() - t_vec:.1f}s).")

        tmp_con.execute("CREATE TABLE search_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        meta_rows = [
            ("built_at", datetime.now(timezone.utc).isoformat()),
            ("fts_count", str(fts_count)),
            ("vec_count", str(vec_count)),
            ("embedding_model", EMBEDDING_MODEL_NAME if vec_count > 0 else "none"),
        ]
        tmp_con.executemany("INSERT INTO search_meta (key, value) VALUES (?, ?)", meta_rows)
        tmp_con.commit()
    finally:
        src_con.close()
        tmp_con.close()

    tmp_path.replace(target_index)
    elapsed = round(time.perf_counter() - t0, 2)
    return {
        "index_path": str(target_index),
        "fts_count": fts_count,
        "vec_count": vec_count,
        "elapsed_seconds": elapsed,
    }


def _row_dict_from_tuple(row: tuple[Any, ...], match_source: str, score: float) -> dict[str, Any]:
    return {
        "review_id": int(row[0]),
        "app_id": int(row[1]),
        "app_name": str(row[2]),
        "language": str(row[3]),
        "recommended": bool(row[4]),
        "votes_helpful": int(row[5]),
        "playtime_at_review_hours": _hours(row[6]),
        "created_at": _created_at(int(row[7])),
        "excerpt": str(row[8] or ""),
        "match_source": match_source,
        "rrf_score": round(score, 6),
    }


def _sql_fallback_search(
    session: Session,
    query: str,
    filters: ReviewFilters,
    limit: int,
) -> dict[str, Any]:
    tokens = _extract_tokens(query)
    if not tokens:
        return {
            "query": query,
            "mode": "sql_fallback",
            "fts_hits": 0,
            "vec_hits": 0,
            "items": [],
            "applied_filters": filters.model_dump(exclude_none=True),
        }

    stmt_and = apply_filters(
        select(Review).where(and_(*[Review.excerpt.ilike(f"%{tok}%") for tok in tokens[:5]])),
        filters,
    ).order_by(Review.votes_helpful.desc(), Review.timestamp_created.desc())
    rows = list(session.scalars(stmt_and.limit(limit)).all())

    if len(rows) < limit and len(tokens) > 1:
        seen = {r.review_id for r in rows}
        stmt_or = apply_filters(
            select(Review).where(or_(*[Review.excerpt.ilike(f"%{tok}%") for tok in tokens[:5]])),
            filters,
        ).order_by(Review.votes_helpful.desc(), Review.timestamp_created.desc())
        for row in session.scalars(stmt_or.limit(limit * 2)).all():
            if row.review_id not in seen:
                rows.append(row)
                seen.add(row.review_id)
                if len(rows) >= limit:
                    break

    items = [
        {
            "review_id": row.review_id,
            "app_id": row.app_id,
            "app_name": row.app_name,
            "language": row.language,
            "recommended": bool(row.recommended),
            "votes_helpful": row.votes_helpful,
            "playtime_at_review_hours": _hours(row.playtime_at_review),
            "created_at": _created_at(row.timestamp_created),
            "excerpt": row.excerpt or "",
            "match_source": "sql_ilike",
            "rrf_score": round(1.0 / (60 + idx + 1), 6),
        }
        for idx, row in enumerate(rows[:limit])
    ]
    return {
        "query": query,
        "mode": "sql_fallback",
        "fts_hits": len(items),
        "vec_hits": 0,
        "items": items,
        "applied_filters": filters.model_dump(exclude_none=True),
    }


def hybrid_search_reviews(
    session: Session,
    query: str,
    filters: ReviewFilters,
    limit: int = 8,
    index_path: Path | None = None,
) -> dict[str, Any]:
    """Busca híbrida RRF (FTS5 BM25 + sqlite-vec KNN) com fallback SQLAlchemy transparente."""
    clamped_limit = max(1, min(15, limit if isinstance(limit, int) else 8))
    cleaned_query = (query or "").strip()
    if not cleaned_query:
        return {
            "query": cleaned_query,
            "mode": "empty",
            "fts_hits": 0,
            "vec_hits": 0,
            "items": [],
            "applied_filters": filters.model_dump(exclude_none=True),
        }

    # Em pytest sem index_path explícito, mantém isolamento usando o banco em memória da suíte.
    if index_path is not None:
        effective_path: Path | None = index_path
    elif os.getenv("PYTEST_CURRENT_TEST"):
        effective_path = None
    else:
        effective_path = DEFAULT_SEARCH_INDEX_PATH

    if effective_path is None or not effective_path.is_file():
        return _sql_fallback_search(session, cleaned_query, filters, clamped_limit)

    con = sqlite3.connect(f"file:{effective_path}?mode=ro", uri=True)
    try:
        where_fts, params_fts = _build_meta_where(filters)
        candidate_k = max(clamped_limit * 4, 30)

        fts_rows: list[tuple[Any, ...]] = []
        fts_expr_and = _sanitize_fts_query(cleaned_query, "AND")
        if fts_expr_and:
            sql_fts = f"""
                SELECT review_id, app_id, app_name, language, recommended,
                       votes_helpful, playtime_at_review, timestamp_created, excerpt
                FROM reviews_fts
                WHERE reviews_fts MATCH ? AND ({where_fts})
                ORDER BY bm25(reviews_fts), votes_helpful DESC
                LIMIT ?
            """
            fts_rows = con.execute(sql_fts, [fts_expr_and, *params_fts, candidate_k]).fetchall()

            if len(fts_rows) < clamped_limit and len(_extract_tokens(cleaned_query)) > 1:
                fts_expr_or = _sanitize_fts_query(cleaned_query, "OR")
                if fts_expr_or:
                    seen_fts = {int(r[0]) for r in fts_rows}
                    extra = con.execute(sql_fts, [fts_expr_or, *params_fts, candidate_k]).fetchall()
                    for row in extra:
                        if int(row[0]) not in seen_fts:
                            fts_rows.append(row)
                            seen_fts.add(int(row[0]))

        vec_rows: list[tuple[Any, ...]] = []
        disable_vec = os.getenv("DISABLE_SEMANTIC_SEARCH", "").strip().lower() in ("1", "true", "yes")
        has_vec_table = (
            con.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='vec_reviews'"
            ).fetchone()
            is not None
        )

        if has_vec_table and not disable_vec and _load_sqlite_vec(con):
            embedder = _get_embedder()
            if embedder is not None:
                try:
                    q_vec = next(iter(embedder.embed([cleaned_query])))
                    q_blob = _serialize_f32(q_vec)
                    vec_k = max(clamped_limit * 8, 80)
                    where_meta, params_meta = _build_meta_where(filters)
                    if where_meta == "1=1":
                        vec_rows = con.execute(
                            """
                            SELECT m.review_id, m.app_id, m.app_name, m.language, m.recommended,
                                   m.votes_helpful, m.playtime_at_review, m.timestamp_created, m.excerpt
                            FROM vec_reviews v
                            JOIN vec_meta m ON m.review_id = v.review_id
                            WHERE v.embedding MATCH ? AND k = ?
                            ORDER BY v.distance ASC
                            """,
                            (q_blob, vec_k),
                        ).fetchall()
                    else:
                        vec_rows = con.execute(
                            f"""
                            SELECT m.review_id, m.app_id, m.app_name, m.language, m.recommended,
                                   m.votes_helpful, m.playtime_at_review, m.timestamp_created, m.excerpt
                            FROM vec_reviews v
                            JOIN vec_meta m ON m.review_id = v.review_id
                            WHERE v.embedding MATCH ? AND k = ?
                              AND v.review_id IN (SELECT review_id FROM vec_meta WHERE {where_meta})
                            ORDER BY v.distance ASC
                            """,
                            (q_blob, vec_k, *params_meta),
                        ).fetchall()
                except Exception as err:
                    logger.warning("Busca vetorial falhou, seguindo com FTS5: %s", err)
                    vec_rows = []

        rrf_k = 60
        scores: dict[int, float] = {}
        rows_by_id: dict[int, tuple[Any, ...]] = {}
        sources: dict[int, set[str]] = {}

        for rank_idx, row in enumerate(fts_rows):
            rid = int(row[0])
            rows_by_id[rid] = row
            scores[rid] = scores.get(rid, 0.0) + 1.0 / (rrf_k + rank_idx + 1)
            sources.setdefault(rid, set()).add("fts5")

        for rank_idx, row in enumerate(vec_rows):
            rid = int(row[0])
            rows_by_id[rid] = row
            scores[rid] = scores.get(rid, 0.0) + 1.0 / (rrf_k + rank_idx + 1)
            sources.setdefault(rid, set()).add("vector")

        ranked_ids = sorted(scores.keys(), key=lambda rid: (-scores[rid], -int(rows_by_id[rid][5])))
        items: list[dict[str, Any]] = []
        for rid in ranked_ids[:clamped_limit]:
            srcs = sources[rid]
            label = "hybrid" if len(srcs) > 1 else next(iter(srcs))
            items.append(_row_dict_from_tuple(rows_by_id[rid], label, scores[rid]))

        mode = "hybrid" if vec_rows else "fts5_only"
        return {
            "query": cleaned_query,
            "mode": mode,
            "fts_hits": len(fts_rows),
            "vec_hits": len(vec_rows),
            "items": items,
            "applied_filters": filters.model_dump(exclude_none=True),
        }
    finally:
        con.close()
