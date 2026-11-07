import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.chat import run_chat_agent
from backend.app.database import SessionLocal, get_db, init_db
from backend.app.queries import charts, list_reviews, metrics, warmup_caches
from backend.app.schemas import (
    ChartsResponse,
    ChatRequest,
    ChatResponse,
    MetricsResponse,
    ReviewFilters,
    ReviewListResponse,
    ReviewSortBy,
    SortDir,
)
from backend.app.transform import PLAYTIME_BUCKETS

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


cors_origins_env = os.getenv("CORS_ORIGINS")
if cors_origins_env:
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    cors_origins = ["*"]

app = FastAPI(title="Steam Reviews", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _reject_unknown_bucket(playtime_bucket: str | None) -> None:
    if playtime_bucket is not None and playtime_bucket not in PLAYTIME_BUCKETS:
        allowed = ", ".join(PLAYTIME_BUCKETS)
        raise HTTPException(
            status_code=422,
            detail=(
                f"playtime_bucket inválido: {playtime_bucket!r}. "
                f"Valores aceitos: {allowed}."
            ),
        )


def parse_filters(
    app_id: int | None = Query(default=None),
    language: str | None = Query(default=None),
    recommended: bool | None = Query(default=None),
    steam_purchase: bool | None = Query(default=None),
    received_for_free: bool | None = Query(default=None),
    early_access: bool | None = Query(default=None),
    playtime_bucket: str | None = Query(default=None),
    date_from: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
) -> ReviewFilters:
    _reject_unknown_bucket(playtime_bucket)
    return ReviewFilters(
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


# O Kaspersky desta máquina troca o fetch da página para /api/metrics
# por um PNG com status 499. A rota original continua; o painel usa o alias.
@app.get("/api/metrics", response_model=MetricsResponse)
@app.get("/api/summary", response_model=MetricsResponse)
def get_metrics(
    response: Response,
    filters: ReviewFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
) -> MetricsResponse:
    response.headers["Cache-Control"] = (
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )
    return metrics(db, filters)


@app.get("/api/charts", response_model=ChartsResponse)
def get_charts(
    response: Response,
    filters: ReviewFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
) -> ChartsResponse:
    response.headers["Cache-Control"] = (
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )
    return charts(db, filters)


@app.get("/api/reviews", response_model=ReviewListResponse)
def get_reviews(
    response: Response,
    filters: ReviewFilters = Depends(parse_filters),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    sort_by: ReviewSortBy = Query(default="created_at"),
    sort_dir: SortDir = Query(default="desc"),
    db: Session = Depends(get_db),
) -> ReviewListResponse:
    response.headers["Cache-Control"] = (
        "public, max-age=300, s-maxage=1800, stale-while-revalidate=3600"
    )
    return list_reviews(db, filters, limit, offset, sort_by=sort_by, sort_dir=sort_dir)


@app.post("/api/chat", response_model=ChatResponse)
def post_chat(
    payload: ChatRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> ChatResponse:
    _reject_unknown_bucket(payload.filters.playtime_bucket)
    response.headers["Cache-Control"] = "no-store"
    return run_chat_agent(db, payload)

