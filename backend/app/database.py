from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

DB_PATH = Path(__file__).resolve().parents[2] / "backend" / "data" / "reviews.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    "sqlite:///" + DB_PATH.as_posix(),
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from backend.app.models import Base

    Base.metadata.create_all(bind=engine)
