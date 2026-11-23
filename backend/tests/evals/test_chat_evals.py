from __future__ import annotations

import asyncio
import json
import os
import re

import pytest
from deepeval import assert_test
from deepeval.metrics import FaithfulnessMetric, ToolCorrectnessMetric
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import LLMTestCase, ToolCall
from langchain_openai import ChatOpenAI

from backend.app.chat import (
    DEFAULT_FALLBACK_MODELS,
    DEFAULT_OPENROUTER_MODEL,
    OPENROUTER_BASE_URL,
    get_config_var,
    normalize_model_name,
    run_chat_agent_async,
)
from backend.app.database import DB_PATH, SessionLocal
from backend.app.queries import metrics
from backend.app.schemas import ChatRequest, ReviewFilters

pytestmark = pytest.mark.eval


class OpenRouterEvalJudge(DeepEvalBaseLLM):
    """Juiz DeepEval com fallback em modelos gratuitos OpenRouter e controle de concorrência."""

    def __init__(self, model_names: list[str], api_key: str) -> None:
        self._models = [normalize_model_name(m) for m in model_names if m]
        self.model_name = self._models[0]
        self._clients = [
            ChatOpenAI(
                base_url=OPENROUTER_BASE_URL,
                api_key=api_key,
                model=m,
                temperature=0.0,
                max_tokens=4096,
                max_retries=1,
            )
            for m in self._models
        ]
        self._sem = asyncio.Semaphore(1)

    def load_model(self):
        return self._clients[0]

    def _runnable_with_fallbacks(self, schema=None):
        if schema is None:
            base = self._clients[0]
            return base.with_fallbacks(self._clients[1:]) if len(self._clients) > 1 else base
        structured_clients = [c.with_structured_output(schema) for c in self._clients]
        return (
            structured_clients[0].with_fallbacks(structured_clients[1:])
            if len(structured_clients) > 1
            else structured_clients[0]
        )

    def generate(self, prompt: str, schema=None):
        if schema is not None:
            return self.generate_with_schema(prompt, schema)
        res = self._runnable_with_fallbacks().invoke(prompt)
        return str(res.content or "")

    async def a_generate(self, prompt: str, schema=None):
        if schema is not None:
            return await self.a_generate_with_schema(prompt, schema)
        async with self._sem:
            res = await self._runnable_with_fallbacks().ainvoke(prompt)
            return str(res.content or "")

    def generate_with_schema(self, prompt: str, schema, **kwargs):
        try:
            return self._runnable_with_fallbacks(schema).invoke(prompt)
        except Exception:
            res = self._runnable_with_fallbacks().invoke(prompt)
            return str(res.content or "")

    async def a_generate_with_schema(self, prompt: str, schema, **kwargs):
        async with self._sem:
            try:
                return await self._runnable_with_fallbacks(schema).ainvoke(prompt)
            except Exception:
                res = await self._runnable_with_fallbacks().ainvoke(prompt)
                return str(res.content or "")

    def get_model_name(self) -> str:
        return self.model_name


def _require_live_env() -> tuple[str, list[str]]:
    if not DB_PATH.is_file():
        pytest.skip("backend/data/reviews.db não encontrado para eval ao vivo.")
    api_key = get_config_var("OPENROUTER_API_KEY")
    if not api_key:
        pytest.skip("OPENROUTER_API_KEY não configurada para eval ao vivo.")
    primary = os.getenv("OPENROUTER_EVAL_MODEL") or get_config_var(
        "OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL
    )
    candidates = [primary, *DEFAULT_FALLBACK_MODELS]
    deduped = list(dict.fromkeys(c for c in candidates if c))
    return api_key, deduped


def test_eval_grounding_and_tool_correctness():
    api_key, judge_models = _require_live_env()
    judge = OpenRouterEvalJudge(judge_models, api_key)

    with SessionLocal() as session:
        filters = ReviewFilters(playtime_bucket="lt1")
        expected_metrics = metrics(session, filters)

        response = asyncio.run(
            run_chat_agent_async(
                session,
                ChatRequest(
                    message="Quantas avaliações e qual a taxa de aprovação na faixa menor que 1 hora?",
                    filters=filters,
                ),
            )
        )

    assert response.tools_used, "O agente precisa consultar ferramentas SQL antes de responder."
    expected_rate_pct = f"{expected_metrics.recommendation_rate * 100:.1f}".replace(".", ",")
    compact_digits = re.sub(r"[^\d]", "", response.reply)
    assert str(expected_metrics.total_reviews) in compact_digits or expected_rate_pct in response.reply

    test_case = LLMTestCase(
        input="Quantas avaliações e qual a taxa de aprovação na faixa menor que 1 hora?",
        actual_output=response.reply,
        retrieval_context=[
            json.dumps(
                {
                    "total_reviews": expected_metrics.total_reviews,
                    "recommendation_rate": expected_metrics.recommendation_rate,
                },
                ensure_ascii=False,
            )
        ],
        tools_called=[ToolCall(name=name) for name in response.tools_used],
        expected_tools=[ToolCall(name="get_metrics")],
    )

    assert_test(
        test_case,
        [
            ToolCorrectnessMetric(threshold=0.5, model=judge),
            FaithfulnessMetric(threshold=0.7, model=judge),
        ],
    )
