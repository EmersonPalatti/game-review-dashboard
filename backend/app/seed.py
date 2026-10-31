import argparse
import csv
import sys
from pathlib import Path

from backend.app.database import DB_PATH, engine
from backend.app.models import Base
from backend.app.transform import (
    clean_votes_funny,
    make_excerpt,
    parse_bool,
    parse_optional_float,
)

BATCH_SIZE = 5000
INSERT_SQL = """
INSERT INTO reviews (
    review_id,
    app_id,
    app_name,
    language,
    recommended,
    votes_helpful,
    votes_funny,
    comment_count,
    weighted_vote_score,
    timestamp_created,
    timestamp_updated,
    author_steamid,
    playtime_at_review,
    playtime_forever,
    steam_purchase,
    received_for_free,
    early_access,
    excerpt
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""
CSV_NAMES = (
    "review_info.csv",
    "game_info.csv",
    "author_info.csv",
    "purchase_info.csv",
)


def _raise_csv_field_limit() -> None:
    # Há reviews com milhões de caracteres; o limite padrão do csv é 128 KiB.
    limit = sys.maxsize
    while True:
        try:
            csv.field_size_limit(limit)
            return
        except OverflowError:
            limit //= 10


def _reset_database() -> None:
    engine.dispose()
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()
    Base.metadata.create_all(bind=engine)


def _iter_aligned(data_dir: Path):
    paths = [data_dir / name for name in CSV_NAMES]
    files = [path.open(newline="", encoding="utf-8-sig") for path in paths]
    try:
        readers = [csv.DictReader(handle) for handle in files]
        while True:
            rows = []
            for reader in readers:
                try:
                    rows.append(next(reader))
                except StopIteration:
                    rows.append(None)
            if all(row is None for row in rows):
                break
            if any(row is None for row in rows):
                raise RuntimeError("Os quatro CSV não têm o mesmo número de linhas")
            review_ids = [row["review_id"].strip() for row in rows]
            if len(set(review_ids)) != 1:
                raise RuntimeError(
                    "review_id divergente entre review_info, game_info, "
                    f"author_info e purchase_info: {review_ids}"
                )
            yield rows
    finally:
        for handle in files:
            handle.close()


def _record(review: dict, game: dict, author: dict, purchase: dict) -> tuple:
    return (
        int(review["review_id"].strip()),
        int(game["app_id"].strip()),
        game["app_name"],
        review["language"],
        int(parse_bool(review["recommended"])),
        int(float(review["votes_helpful"])),
        clean_votes_funny(review["votes_funny"]),
        int(float(review["comment_count"])),
        float(review["weighted_vote_score"]),
        int(float(review["timestamp_created"])),
        int(float(review["timestamp_updated"])),
        int(author["author.steamid"].strip()),
        parse_optional_float(author["author.playtime_at_review"]),
        parse_optional_float(author["author.playtime_forever"]),
        int(parse_bool(purchase["steam_purchase"])),
        int(parse_bool(purchase["received_for_free"])),
        int(parse_bool(purchase["written_during_early_access"])),
        make_excerpt(review["review"]),
    )


def _insert_batch(conn, batch: list[tuple]) -> None:
    raw = conn.connection.dbapi_connection
    if raw is None:
        raise RuntimeError("conexão DBAPI indisponível")
    raw.executemany(INSERT_SQL, batch)


def load_reviews(data_dir: Path, limit: int | None = None) -> int:
    _raise_csv_field_limit()
    _reset_database()
    inserted = 0
    batch: list[tuple] = []
    with engine.begin() as conn:
        for aligned in _iter_aligned(data_dir):
            if limit is not None and inserted + len(batch) >= limit:
                break
            batch.append(_record(*aligned))
            if len(batch) >= BATCH_SIZE:
                _insert_batch(conn, batch)
                inserted += len(batch)
                batch.clear()
                if inserted % 100_000 == 0:
                    print(inserted, flush=True)
        if batch:
            _insert_batch(conn, batch)
            inserted += len(batch)
    return inserted


def main() -> None:
    parser = argparse.ArgumentParser(description="Carrega os CSV de reviews no SQLite.")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--data-dir", type=Path, default=None)
    args = parser.parse_args()
    data_dir = args.data_dir or Path(__file__).resolve().parents[2] / "data"
    print(load_reviews(data_dir, args.limit))


if __name__ == "__main__":
    main()
