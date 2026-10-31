from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from backend.app.database import get_db, init_db
from backend.app.queries import charts, list_reviews, metrics
from backend.app.schemas import ChartsResponse, MetricsResponse, ReviewFilters, ReviewListResponse
from backend.app.transform import PLAYTIME_BUCKETS


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Steam Reviews", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4321", "http://localhost:4321"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


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
    )


# O Kaspersky desta máquina troca o fetch da página para /api/metrics
# por um PNG com status 499. A rota original continua; o painel usa o alias.
@app.get("/api/metrics", response_model=MetricsResponse)
@app.get("/api/summary", response_model=MetricsResponse)
def get_metrics(
    filters: ReviewFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
) -> MetricsResponse:
    return metrics(db, filters)


@app.get("/api/charts", response_model=ChartsResponse)
def get_charts(
    filters: ReviewFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
) -> ChartsResponse:
    return charts(db, filters)


@app.get("/api/reviews", response_model=ReviewListResponse)
def get_reviews(
    filters: ReviewFilters = Depends(parse_filters),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> ReviewListResponse:
    return list_reviews(db, filters, limit, offset)
