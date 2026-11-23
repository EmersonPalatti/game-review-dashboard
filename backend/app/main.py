import logging
import os
from contextlib import asynccontextmanager
import uuid
from typing import Any

from ag_ui.core import RunAgentInput
from ag_ui.encoder import EventEncoder
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.app.chat import _prepare_runtime, run_chat_agent_async, stream_chat_agui
from backend.app.database import SessionLocal, get_db, init_db
from backend.app.observability import record_chat_feedback
from backend.app.queries import charts, facets, list_reviews, metrics, warmup_caches
from backend.app.schemas import (
    ChartsResponse,
    ChatFeedbackRequest,
    ChatFeedbackResponse,
    ChatHistoryItem,
    ChatRequest,
    ChatResponse,
    FacetsResponse,
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
    # Carrega a cópia analítica e o recorte padrão antes da primeira visita.
    # O Render free reinicia o processo quando acorda, e o cache em memória some.
    try:
        with SessionLocal() as session:
            warmup_caches(session)
    except Exception:
        logger.exception("Falha ao aquecer os caches; as rotas carregam sob demanda.")
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


@app.get("/api/facets", response_model=FacetsResponse)
def get_facets(
    response: Response,
    filters: ReviewFilters = Depends(parse_filters),
    db: Session = Depends(get_db),
) -> FacetsResponse:
    response.headers["Cache-Control"] = (
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
    )
    return facets(db, filters)


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
async def post_chat(
    payload: ChatRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> ChatResponse:
    _reject_unknown_bucket(payload.filters.playtime_bucket)
    response.headers["Cache-Control"] = "no-store"
    return await run_chat_agent_async(db, payload)


def _extract_agui_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                parts.append(str(part.get("text", "")))
            elif isinstance(part, str):
                parts.append(part)
        return "".join(parts)
    return ""


def _parse_stream_request(body: dict[str, Any]) -> tuple[ChatRequest, str, str]:
    """Aceita RunAgentInput do protocolo AG-UI ou ChatRequest direto."""
    if "message" in body and "messages" not in body:
        chat_req = ChatRequest.model_validate(body)
        return chat_req, f"thr_{uuid.uuid4().hex[:12]}", f"run_{uuid.uuid4().hex[:12]}"

    agui_input = RunAgentInput.model_validate(body)
    raw_filters: dict[str, Any] = {}
    if isinstance(agui_input.forwarded_props, dict) and isinstance(agui_input.forwarded_props.get("filters"), dict):
        raw_filters = agui_input.forwarded_props["filters"]
    elif isinstance(agui_input.state, dict) and isinstance(agui_input.state.get("filters"), dict):
        raw_filters = agui_input.state["filters"]

    filters = ReviewFilters.model_validate(raw_filters)

    convo: list[ChatHistoryItem] = []
    for msg in agui_input.messages:
        role = getattr(msg, "role", None)
        if role not in ("user", "assistant"):
            continue
        text = _extract_agui_message_text(getattr(msg, "content", ""))
        if text.strip():
            convo.append(ChatHistoryItem(role=role, content=text))

    if not convo or convo[-1].role != "user":
        raise HTTPException(status_code=422, detail="A mensagem não pode estar vazia.")

    latest_msg = convo[-1].content
    history = convo[:-1]
    return (
        ChatRequest(message=latest_msg, filters=filters, history=history),
        agui_input.thread_id,
        agui_input.run_id,
    )


@app.post("/api/chat/stream")
async def post_chat_stream(
    request: Request,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    try:
        body = await request.json()
    except Exception as err:
        raise HTTPException(status_code=422, detail="Payload JSON inválido.") from err

    if not isinstance(body, dict):
        raise HTTPException(status_code=422, detail="Payload JSON inválido.")

    chat_req, thread_id, run_id = _parse_stream_request(body)
    _reject_unknown_bucket(chat_req.filters.playtime_bucket)
    _prepare_runtime(chat_req, llm=None, streaming=True)

    encoder = EventEncoder(accept=request.headers.get("accept"))

    async def event_generator():
        async for ev in stream_chat_agui(db, chat_req, thread_id=thread_id, run_id=run_id):
            yield encoder.encode(ev)

    return StreamingResponse(
        event_generator(),
        media_type=encoder.get_content_type(),
        headers={
            "Cache-Control": "no-cache, no-store",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/chat/feedback", response_model=ChatFeedbackResponse)
def post_chat_feedback(
    payload: ChatFeedbackRequest,
    response: Response,
) -> ChatFeedbackResponse:
    response.headers["Cache-Control"] = "no-store"
    traced = record_chat_feedback(
        trace_id=payload.trace_id,
        score=payload.score,
        comment=payload.comment,
    )
    return ChatFeedbackResponse(recorded=True, traced=traced, trace_id=payload.trace_id)
