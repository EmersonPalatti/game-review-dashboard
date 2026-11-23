from __future__ import annotations

import logging
import os
import uuid
from typing import Any

from backend.app.config import get_config_var

logger = logging.getLogger(__name__)

_langfuse_client: Any | None = None
_langfuse_init_attempted = False


def is_langfuse_enabled() -> bool:
    """Ativa Langfuse v5 apenas quando chaves pública e secreta estão configuradas."""
    if os.getenv("PYTEST_CURRENT_TEST") and not os.getenv("LANGFUSE_ALLOW_IN_TESTS"):
        return False
    pk = get_config_var("LANGFUSE_PUBLIC_KEY")
    sk = get_config_var("LANGFUSE_SECRET_KEY")
    return bool(pk and sk)


def get_langfuse_client() -> Any | None:
    """Retorna cliente singleton do Langfuse v5 ou None quando desativado."""
    global _langfuse_client, _langfuse_init_attempted
    if not is_langfuse_enabled():
        return None
    if _langfuse_client is not None:
        return _langfuse_client
    if _langfuse_init_attempted:
        return None
    _langfuse_init_attempted = True
    try:
        from langfuse import Langfuse

        host = get_config_var("LANGFUSE_HOST") or get_config_var("LANGFUSE_BASE_URL") or "https://cloud.langfuse.com"
        _langfuse_client = Langfuse(
            public_key=get_config_var("LANGFUSE_PUBLIC_KEY"),
            secret_key=get_config_var("LANGFUSE_SECRET_KEY"),
            host=host,
        )
        return _langfuse_client
    except Exception as err:
        logger.warning("Não foi possível inicializar Langfuse v5: %s", err)
        return None


def generate_trace_id() -> str:
    """Gera trace_id hexadecimal de 32 chars compatível com OpenTelemetry/Langfuse v5."""
    return uuid.uuid4().hex


def create_langfuse_handler(
    trace_id: str | None = None,
    session_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> tuple[Any | None, str]:
    """Cria CallbackHandler LangChain do Langfuse v5 quando habilitado."""
    resolved_trace_id = trace_id or generate_trace_id()
    if not is_langfuse_enabled():
        return None, resolved_trace_id

    client = get_langfuse_client()
    if client is None:
        return None, resolved_trace_id

    try:
        from langfuse.langchain import CallbackHandler
        from langfuse.types import TraceContext

        handler = CallbackHandler(
            public_key=get_config_var("LANGFUSE_PUBLIC_KEY"),
            trace_context=TraceContext(trace_id=resolved_trace_id),
        )
        # Armazena metadados opcionais sem quebrar assinaturas futuras
        if session_id or metadata:
            logger.debug("Langfuse trace iniciado: trace_id=%s session_id=%s", resolved_trace_id, session_id)
        return handler, resolved_trace_id
    except Exception as err:
        logger.warning("Falha ao criar CallbackHandler Langfuse: %s", err)
        return None, resolved_trace_id


def record_chat_feedback(
    trace_id: str,
    score: int,
    comment: str | None = None,
) -> bool:
    """Envia score 👍/👎 (1/0) para o trace no Langfuse v5 quando habilitado."""
    client = get_langfuse_client()
    if client is None:
        return False

    try:
        client.create_score(
            name="user-feedback",
            value=float(score),
            trace_id=trace_id,
            data_type="NUMERIC",
            comment=comment,
        )
        if hasattr(client, "flush"):
            client.flush()
        return True
    except Exception as err:
        logger.warning("Falha ao registrar feedback no Langfuse: %s", err)
        return False
