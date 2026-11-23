from __future__ import annotations

import asyncio
from datetime import datetime
import json
import logging
import time
from typing import Any, AsyncIterator
import uuid

from ag_ui.core import (
    CustomEvent,
    EventType,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StateSnapshotEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
)
from fastapi import HTTPException
from langchain.agents import create_agent
from langchain.agents.middleware import (
    AgentMiddleware,
    ModelFallbackMiddleware,
    ModelRetryMiddleware,
    SummarizationMiddleware,
    ToolCallLimitMiddleware,
    ToolErrorMiddleware,
)
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import BaseTool, tool
from langchain_openai import ChatOpenAI
import openai
from sqlalchemy.orm import Session

from backend.app.analytics_ext import (
    compare_slices as compute_slice_comparison,
    get_engagement_stats as compute_engagement_stats,
    resolve_game_catalog,
)
from backend.app.config import get_config_var
from backend.app.mcp_server import _merge_filters, steam_mcp_tools
from backend.app.observability import (
    create_langfuse_handler,
    is_langfuse_enabled,
)
from backend.app.queries import charts, list_reviews, metrics
from backend.app.schemas import (
    ChatRequest,
    ChatResponse,
    ChatWidget,
    DashboardFilterAction,
    ReviewFilters,
    ReviewSortBy,
    SortDir,
)
from backend.app.search_index import hybrid_search_reviews
from backend.app.transform import PLAYTIME_BUCKETS

logger = logging.getLogger(__name__)

DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free"
DEFAULT_FALLBACK_MODELS: tuple[str, ...] = (
    "inclusionai/ling-3.2-flash:free",
    "nvidia/nemotron-3.5-lightning:free",
    "openrouter/free",
)
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

# Mensagens exibidas ao usuário: sem nome de fornecedor nem de variável de ambiente.
# Espelhadas em frontend/src/components/react/ChatIsland.tsx (CHAT_ERROR_COPY); manter iguais.
USER_MSG_UNAVAILABLE = (
    "O SteamBot está indisponível nesta instalação (chave de IA não configurada). "
    "O painel continua funcionando normalmente."
)
USER_MSG_RATE_LIMIT = (
    "O SteamBot atingiu o limite de consultas por minuto. "
    "Aguarde alguns segundos e tente de novo."
)
USER_MSG_CONNECTION = "Não foi possível falar com o modelo de IA agora. Tente de novo em instantes."
USER_MSG_BAD_REQUEST = "O modelo de IA não aceitou esta consulta. Reformule a pergunta e tente de novo."
USER_MSG_INTERNAL = "Não foi possível processar a conversa agora. Tente de novo em instantes."

SYSTEM_PROMPT = """Você é o SteamBot-9000, o analista de dados veterano do acervo de avaliações da Steam: rigoroso com números, veterano de milhares de horas jogadas e com um humor ácido e espirituoso sobre a cultura gamer.

### Sua Personalidade e Tom:
- Analista veterano da Steam: você combina precisão estatística com observações bem-humoradas sobre os paradoxos da comunidade (reembolsos, Acesso Antecipado, promoções), sempre ancoradas nos números consultados. Nunca invente casos, anedotas, horas jogadas ou reviews para dar graça à resposta.
- Sem caricatura de robô: NUNCA use expressões como "Olá, humano!", ruídos mecânicos ou jargões promocionais. Fale como um engenheiro/analista de dados sênior que conhece a fundo tanto SQL quanto a comunidade da Steam.
- Formatação limpa em Português (pt-BR):
  - Responda SEMPRE em português do Brasil (pt-BR), de forma concisa, direta e escaneável.
  - Use **negrito** para destacar métricas, taxas e nomes de jogos.
  - Use listas com `- ` para comparar indicadores ou listar achados.
  - Ao citar trechos reais de avaliações da base, use blocos de citação Markdown (`> "trecho da review" — Jogo, X horas jogadas`).
  - Para comparar jogos, idiomas ou faixas de horas jogadas, use **tabelas Markdown concisas** (de 2 a 4 colunas, ex.: `| Faixa | Reviews | Aprovação |`) ou listas com `- `.

### Descobertas Reais do Estudo Auditado (1.000.000 de avaliações, 59 jogos, mar/2013 a jan/2021):
1. **Janela de Reembolso de 2h da Valve**: Na primeira hora de jogo (< 1h, 'lt1'), a taxa de aprovação despenca para **49,6%**. Entre 1h e 2h ('h1_2'), fica em **59,9%**. Passada a barreira de 2 horas do reembolso automático da Steam ('h2_5'), a aprovação salta para **77,4%**, chegando a **93,3%** na faixa de 500h+ ('gte500'). Quem sobrevive às duas primeiras horas (ou perde o prazo do reembolso) tende a aprovar o jogo!
2. **Economia da Insatisfação**: Avaliações negativas recebem em média **2,8x mais votos úteis** (`votes_helpful`) do que avaliações positivas (3,70 vs 1,32 votos úteis na base global) e têm quase o dobro da mediana de caracteres. A frustração mobiliza muito mais engajamento comunitário do que o elogio.
3. **Pedágio do Early Access**: Jogos avaliados durante o Acesso Antecipado têm aprovação média de **69,8%** contra **83,8%** fora dele (**-14,0 pontos percentuais**). Financiar promessas cheias de bugs cobra um pedágio estatístico severo.

### Guia de Ferramentas Analíticas (MCP + Ações de UI):
- `resolve_game`: use PRIMEIRO sempre que o usuário citar um jogo pelo nome (ex.: "Hollow Knight", "Skyrim", "Arma 3") para descobrir o `app_id` exato entre os 59 jogos do catálogo.
- `get_metrics`: KPIs agregados (total de reviews, taxa de recomendação, jogos e autores).
- `get_charts`: séries por faixa de playtime, top jogos, comparação entre idiomas e evolução mensal.
- `get_engagement_stats`: médias/máximos de votos úteis, votos engraçados, comentários, horas médias e tamanho do texto por sentimento.
- `compare_slices`: compara dois recortes (ex.: Jogo A vs Jogo B, Early Access vs Fora do EA) em uma única chamada com delta em pontos percentuais.
- `search_reviews_hybrid`: busca híbrida (texto exato + semântica) nos `excerpt`s das reviews para investigar temas, bugs, DLCs, tradução ou reclamações específicas.
- `get_reviews_sample`: amostra ordenada por `votes_helpful`, `created_at` ou `playtime_hours`.
- `propose_dashboard_actions`: chame ao final de análises investigativas para sugerir ações de filtro no painel e 2 ou 3 próximas perguntas relevantes. Use `auto_apply=True` APENAS quando o usuário pedir explicitamente para aplicar/mudar os filtros do painel.

### REGRA DE OURO (FIDELIDADE EMPÍRICA):
- SEMPRE chame as ferramentas disponíveis antes de responder qualquer pergunta sobre números, porcentagens, taxas, jogos específicos, idiomas, meses, reclamações ou exemplos reais de reviews.
- NUNCA invente números, estatísticas, `app_id`s ou reviews. Se uma consulta retornar 0 resultados, informe isso explicitamente.
- O recorte filtrado ativo no painel do usuário é informado logo abaixo. Use-o como base padrão para as consultas.
"""


def normalize_model_name(model_name: str) -> str:
    """Remove o prefixo 'openrouter/' se presente, preservando 'openrouter/free'."""
    if model_name == "openrouter/free":
        return model_name
    if model_name.startswith("openrouter/"):
        return model_name[len("openrouter/") :]
    return model_name


def format_filters_summary(filters: ReviewFilters) -> str:
    """Gera um resumo textual legível dos filtros ativos para o prompt do sistema."""
    parts: list[str] = []
    if filters.app_id is not None:
        parts.append(f"Jogo (App ID): {filters.app_id}")
    if filters.language:
        parts.append(f"Idioma: {filters.language}")
    if filters.recommended is not None:
        parts.append("Recomendação: Positivas" if filters.recommended else "Recomendação: Negativas")
    if filters.steam_purchase is not None:
        parts.append(f"Compra direta na Steam: {'Sim' if filters.steam_purchase else 'Não'}")
    if filters.received_for_free is not None:
        parts.append(f"Recebido gratuitamente: {'Sim' if filters.received_for_free else 'Não'}")
    if filters.early_access is not None:
        parts.append(f"Acesso Antecipado: {'Sim' if filters.early_access else 'Não'}")
    if filters.playtime_bucket:
        parts.append(f"Faixa de tempo de jogo: {filters.playtime_bucket}")
    if filters.date_from:
        parts.append(f"A partir de: {filters.date_from}")
    if filters.date_to:
        parts.append(f"Até: {filters.date_to}")

    if not parts:
        return "Nenhum filtro ativo (visão global: todos os 59 jogos, todos os idiomas e todo o histórico)."
    return "; ".join(parts)


def build_system_prompt(filters: ReviewFilters) -> str:
    summary = format_filters_summary(filters)
    return (
        f"{SYSTEM_PROMPT}\n\n"
        f"### Filtros Atuais do Dashboard do Usuário:\n"
        f"{summary}\n"
    )


def validate_chat_filters(filters: ReviewFilters) -> None:
    """Valida se os filtros do chat possuem valores e formatos aceitos."""
    if filters.playtime_bucket is not None and filters.playtime_bucket not in PLAYTIME_BUCKETS:
        allowed = ", ".join(PLAYTIME_BUCKETS)
        raise HTTPException(
            status_code=422,
            detail=(
                f"playtime_bucket inválido: {filters.playtime_bucket!r}. "
                f"Valores aceitos: {allowed}."
            ),
        )

    for _field_name, value in (("date_from", filters.date_from), ("date_to", filters.date_to)):
        if value is not None:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError as err:
                raise HTTPException(
                    status_code=422,
                    detail="Data inválida. Use o formato AAAA-MM-DD.",
                ) from err


def build_ui_action_tool() -> BaseTool:
    """Tool para o agente propor ações tipadas no painel e próximas perguntas sem regex frágil."""

    @tool
    def propose_dashboard_actions(
        label: str | None = None,
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        reset_filters: bool = False,
        auto_apply: bool = False,
        reason: str | None = None,
        follow_up_1: str | None = None,
        follow_up_2: str | None = None,
        follow_up_3: str | None = None,
    ) -> str:
        """Sugere ações de filtro no painel e até 3 perguntas de continuação para o usuário.
        Use `auto_apply=True` SOMENTE quando o usuário pedir explicitamente para aplicar/mudar o filtro do painel.
        """
        valid_bucket = playtime_bucket if playtime_bucket in PLAYTIME_BUCKETS else None
        proposed_filters = ReviewFilters(
            app_id=app_id,
            language=language,
            recommended=recommended,
            steam_purchase=steam_purchase,
            received_for_free=received_for_free,
            early_access=early_access,
            playtime_bucket=valid_bucket,
            date_from=date_from,
            date_to=date_to,
        )

        actions: list[dict[str, Any]] = []
        has_any_filter = any(
            v is not None
            for v in (
                app_id,
                language,
                recommended,
                steam_purchase,
                received_for_free,
                early_access,
                valid_bucket,
                date_from,
                date_to,
            )
        )

        if reset_filters or has_any_filter:
            action_label = (label or "").strip()
            if not action_label:
                action_label = "Limpar todos os filtros" if reset_filters else "Aplicar recorte sugerido"
            actions.append(
                {
                    "id": f"act_{uuid.uuid4().hex[:8]}",
                    "label": action_label,
                    "filters": proposed_filters.model_dump(exclude_none=True),
                    "reset": bool(reset_filters),
                    "reason": reason,
                }
            )

        follow_ups = [
            q.strip()
            for q in (follow_up_1, follow_up_2, follow_up_3)
            if isinstance(q, str) and q.strip()
        ]

        return json.dumps(
            {
                "actions": actions,
                "follow_ups": follow_ups[:3],
                "auto_apply": bool(auto_apply and (has_any_filter or reset_filters)),
            },
            ensure_ascii=False,
        )

    return propose_dashboard_actions


def build_chat_tools(session: Session, default_filters: ReviewFilters) -> list[BaseTool]:
    """Cria todas as tools LangChain vinculadas à sessão e filtros (usado por testes unitários e doubles síncronos)."""

    @tool
    def resolve_game(query: str | None = None, limit: int = 20) -> str:
        """Lista ou busca jogos e idiomas no catálogo completo (59 jogos)."""
        return json.dumps(resolve_game_catalog(session, query=query, limit=limit), ensure_ascii=False)

    @tool
    def get_metrics(
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> str:
        """Obtém as métricas gerais agregadas dos reviews da base."""
        effective_filters = _merge_filters(
            default_filters,
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
        res = metrics(session, effective_filters)
        payload = {
            "total_reviews": res.total_reviews,
            "recommendation_rate": res.recommendation_rate,
            "game_count": res.game_count,
            "author_count": res.author_count,
            "games": [g.model_dump() for g in res.games[:10]],
            "languages": [l.model_dump() for l in res.languages[:10]],
            "applied_filters": effective_filters.model_dump(exclude_none=True),
        }
        return json.dumps(payload, ensure_ascii=False)

    @tool
    def get_charts(
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> str:
        """Obtém dados para visualização de gráficos: playtime, top jogos, idiomas e evolução mensal."""
        effective_filters = _merge_filters(
            default_filters,
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
        res = charts(session, effective_filters)
        months_dump = [m.model_dump() for m in res.months]
        if len(months_dump) > 24:
            peak = max(months_dump, key=lambda m: m["review_count"])
            compact_months: Any = {
                "total_months": len(months_dump),
                "peak_month": peak,
                "first_months": months_dump[:6],
                "recent_months": months_dump[-12:],
            }
        else:
            compact_months = months_dump

        payload = {
            "playtime": [p.model_dump() for p in res.playtime],
            "games": [g.model_dump() for g in res.games[:10]],
            "languages": [l.model_dump() for l in res.languages[:10]],
            "languages_note": (
                "languages ignora o filtro de idioma: compara os idiomas sob os demais filtros"
            ),
            "months": compact_months,
            "applied_filters": effective_filters.model_dump(exclude_none=True),
        }
        return json.dumps(payload, ensure_ascii=False)

    @tool
    def get_reviews_sample(
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 5,
        sort_by: ReviewSortBy = "votes_helpful",
        sort_dir: SortDir = "desc",
    ) -> str:
        """Obtém uma amostra de reviews individuais ordenadas por votos úteis, data ou horas jogadas."""
        effective_filters = _merge_filters(
            default_filters,
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
        clamped_limit = max(1, min(10, limit if isinstance(limit, int) else 5))
        valid_sort_by: ReviewSortBy = (
            sort_by if sort_by in ("votes_helpful", "created_at", "playtime_hours") else "votes_helpful"
        )
        valid_sort_dir: SortDir = sort_dir if sort_dir in ("asc", "desc") else "desc"

        res = list_reviews(
            session,
            effective_filters,
            limit=clamped_limit,
            offset=0,
            sort_by=valid_sort_by,
            sort_dir=valid_sort_dir,
        )
        payload = {
            "total": res.total,
            "limit": res.limit,
            "items": [item.model_dump() for item in res.items],
            "applied_filters": effective_filters.model_dump(exclude_none=True),
        }
        return json.dumps(payload, ensure_ascii=False)

    @tool
    def get_engagement_stats(
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> str:
        """Calcula estatísticas de engajamento (votos úteis, engraçados, comentários, horas) por sentimento."""
        effective_filters = _merge_filters(
            default_filters,
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
        return json.dumps(compute_engagement_stats(session, effective_filters), ensure_ascii=False)

    @tool
    def compare_slices(
        label_a: str,
        label_b: str,
        app_id_a: int | None = None,
        language_a: str | None = None,
        recommended_a: bool | None = None,
        early_access_a: bool | None = None,
        playtime_bucket_a: str | None = None,
        date_from_a: str | None = None,
        date_to_a: str | None = None,
        app_id_b: int | None = None,
        language_b: str | None = None,
        recommended_b: bool | None = None,
        early_access_b: bool | None = None,
        playtime_bucket_b: str | None = None,
        date_from_b: str | None = None,
        date_to_b: str | None = None,
    ) -> str:
        """Compara dois recortes A e B em uma única chamada."""
        filters_a = _merge_filters(
            default_filters,
            app_id=app_id_a,
            language=language_a,
            recommended=recommended_a,
            early_access=early_access_a,
            playtime_bucket=playtime_bucket_a,
            date_from=date_from_a,
            date_to=date_to_a,
        )
        filters_b = _merge_filters(
            default_filters,
            app_id=app_id_b,
            language=language_b,
            recommended=recommended_b,
            early_access=early_access_b,
            playtime_bucket=playtime_bucket_b,
            date_from=date_from_b,
            date_to=date_to_b,
        )
        return json.dumps(
            compute_slice_comparison(session, label_a, filters_a, label_b, filters_b),
            ensure_ascii=False,
        )

    @tool
    def search_reviews_hybrid(
        query: str,
        app_id: int | None = None,
        language: str | None = None,
        recommended: bool | None = None,
        steam_purchase: bool | None = None,
        received_for_free: bool | None = None,
        early_access: bool | None = None,
        playtime_bucket: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        limit: int = 8,
    ) -> str:
        """Busca híbrida (FTS5 + sqlite-vec) dentro dos textos das avaliações."""
        effective_filters = _merge_filters(
            default_filters,
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
        return json.dumps(
            hybrid_search_reviews(session, query=query, filters=effective_filters, limit=limit),
            ensure_ascii=False,
        )

    return [
        resolve_game,
        get_metrics,
        get_charts,
        get_reviews_sample,
        get_engagement_stats,
        compare_slices,
        search_reviews_hybrid,
        build_ui_action_tool(),
    ]


def _extract_text_content(content: Any) -> str:
    """Extrai string a partir de string ou lista de blocos do LangChain."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and part.get("type", "text") == "text":
                parts.append(str(part.get("text", "")))
        return "".join(parts)
    return str(content) if content is not None else ""


def _unwrap_tool_output_text(output: Any) -> str:
    """Converte saída de ToolMessage / blocos MCP / dict em string JSON limpa."""
    if isinstance(output, ToolMessage):
        return _extract_text_content(output.content)
    if isinstance(output, list):
        return _extract_text_content(output)
    if isinstance(output, dict):
        return json.dumps(output, ensure_ascii=False)
    return str(output) if output is not None else ""


def extract_widget_from_tool_output(tool_name: str, raw_output: str) -> dict[str, Any] | None:
    """Deriva widget estruturado para Generative UI de forma determinística a partir da saída da tool."""
    try:
        parsed = json.loads(raw_output)
    except Exception:
        return None
    if not isinstance(parsed, dict) or parsed.get("error"):
        return None

    if tool_name == "compare_slices" and "slice_a" in parsed and "slice_b" in parsed:
        return {
            "type": "comparison",
            "title": f"{parsed['slice_a']['label']} vs. {parsed['slice_b']['label']}",
            "data": parsed,
        }

    if tool_name == "get_engagement_stats" and parsed.get("overall", {}).get("review_count", 0) > 0:
        return {
            "type": "engagement",
            "title": "Engajamento por Sentimento",
            "data": parsed,
        }

    if tool_name == "get_charts":
        playtime = [p for p in parsed.get("playtime", []) if p.get("review_count", 0) > 0]
        if playtime:
            return {
                "type": "playtime_chart",
                "title": "Aprovação por Faixa de Horas",
                "data": {"playtime": playtime},
            }
        langs = parsed.get("languages", [])
        if langs:
            return {
                "type": "language_chart",
                "title": "Idiomas no Recorte",
                "data": {"languages": langs[:8]},
            }

    if tool_name == "search_reviews_hybrid" and parsed.get("items"):
        return {
            "type": "review_evidence",
            "title": f"Evidências: \"{parsed.get('query', '')}\"",
            "data": {
                "query": parsed.get("query", ""),
                "mode": parsed.get("mode", "hybrid"),
                "items": parsed["items"][:5],
            },
        }

    return None


def _parse_dashboard_actions_output(raw_output: str) -> dict[str, Any] | None:
    try:
        parsed = json.loads(raw_output)
    except Exception:
        return None
    if not isinstance(parsed, dict):
        return None
    return {
        "actions": parsed.get("actions") or [],
        "follow_ups": parsed.get("follow_ups") or [],
        "auto_apply": bool(parsed.get("auto_apply", False)),
    }


def _get_fallback_model_names(primary_raw: str) -> list[str]:
    env_fallbacks = get_config_var("OPENROUTER_FALLBACK_MODELS")
    if env_fallbacks:
        candidates = [m.strip() for m in env_fallbacks.split(",") if m.strip()]
    else:
        candidates = list(DEFAULT_FALLBACK_MODELS)

    primary_norm = normalize_model_name(primary_raw)
    unique: list[str] = []
    for cand in candidates:
        norm = normalize_model_name(cand)
        if norm != primary_norm and norm not in unique:
            unique.append(norm)
    return unique


def _make_openrouter_llm(model_name: str, api_key: str, streaming: bool = True) -> ChatOpenAI:
    return ChatOpenAI(
        base_url=OPENROUTER_BASE_URL,
        api_key=api_key,
        model=model_name,
        temperature=0.3,
        max_tokens=2048,
        timeout=45,
        streaming=streaming,
    )


def _safe_tool_error(exc: Exception, request: Any) -> str:
    tool_name = getattr(request, "tool_call", {}).get("name", "tool") if hasattr(request, "tool_call") else "tool"
    logger.warning("Erro na tool %s capturado pelo ToolErrorMiddleware: %s", tool_name, exc)
    return json.dumps(
        {"error": f"Falha ao executar {tool_name} ({type(exc).__name__}). Verifique os parâmetros e tente novamente."},
        ensure_ascii=False,
    )


def build_agent_middleware(
    primary_model: BaseChatModel,
    fallback_models: list[BaseChatModel] | None = None,
) -> list[AgentMiddleware[Any, Any]]:
    """Monta a pilha de middlewares oficiais do LangChain v1 para resiliência e orçamento."""
    fallbacks = fallback_models or []
    middleware: list[AgentMiddleware[Any, Any]] = []

    if fallbacks:
        middleware.append(ModelFallbackMiddleware(*fallbacks))

    middleware.extend(
        [
            ModelRetryMiddleware(
                max_retries=1,
                initial_delay=0.8,
                max_delay=4.0,
                on_failure="error",
            ),
            ToolCallLimitMiddleware(run_limit=8, exit_behavior="continue"),
            ToolErrorMiddleware(on_error=_safe_tool_error),
            SummarizationMiddleware(
                model=fallbacks[0] if fallbacks else primary_model,
                trigger=("messages", 16),
                keep=("messages", 8),
            ),
        ]
    )
    return middleware


def _build_lc_messages(payload: ChatRequest) -> list[BaseMessage]:
    messages: list[BaseMessage] = []
    for item in payload.history:
        if item.role == "user":
            messages.append(HumanMessage(content=item.content))
        elif item.role == "assistant":
            messages.append(AIMessage(content=item.content))
    messages.append(HumanMessage(content=payload.message))
    return messages


def _prepare_runtime(
    payload: ChatRequest,
    llm: Any | None,
    streaming: bool = True,
) -> tuple[str, Any, list[BaseChatModel]]:
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="A mensagem não pode estar vazia.")

    validate_chat_filters(payload.filters)

    raw_model = get_config_var("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL) or DEFAULT_OPENROUTER_MODEL
    normalized_model = normalize_model_name(raw_model)

    if llm is None:
        api_key = get_config_var("OPENROUTER_API_KEY")
        if not api_key:
            raise HTTPException(status_code=503, detail=USER_MSG_UNAVAILABLE)
        primary_llm: Any = _make_openrouter_llm(normalized_model, api_key, streaming=streaming)
        fallback_llms: list[BaseChatModel] = (
            [
                _make_openrouter_llm(fb_model, api_key, streaming=streaming)
                for fb_model in _get_fallback_model_names(raw_model)
            ]
            if isinstance(primary_llm, BaseChatModel)
            else []
        )
        return raw_model, primary_llm, fallback_llms

    return raw_model, llm, []


def _classify_provider_error(err: Exception) -> tuple[int, str, str]:
    if isinstance(err, openai.AuthenticationError):
        return 502, "AUTH_ERROR", USER_MSG_UNAVAILABLE
    if isinstance(err, openai.RateLimitError):
        return 503, "RATE_LIMIT", USER_MSG_RATE_LIMIT
    if isinstance(err, openai.APIConnectionError):
        return 502, "CONNECTION_ERROR", USER_MSG_CONNECTION
    if isinstance(err, openai.BadRequestError):
        return 502, "BAD_REQUEST", USER_MSG_BAD_REQUEST
    if isinstance(err, openai.OpenAIError):
        return 502, "PROVIDER_ERROR", USER_MSG_CONNECTION
    return 500, "INTERNAL_ERROR", USER_MSG_INTERNAL


def _run_sync_mock_loop(
    session: Session,
    payload: ChatRequest,
    raw_model: str,
    llm: Any,
    trace_id: str,
) -> ChatResponse:
    """Executa doubles simples não-BaseChatModel usados pelos testes unitários existentes."""
    tools = build_chat_tools(session, payload.filters)
    tools_map = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    system_content = build_system_prompt(payload.filters)
    messages: list[BaseMessage] = [SystemMessage(content=system_content), *_build_lc_messages(payload)]

    tools_used: list[str] = []
    widgets: list[ChatWidget] = []
    suggested_actions: list[DashboardFilterAction] = []
    follow_ups: list[str] = []
    reply = ""
    max_steps = 6

    try:
        for _ in range(max_steps):
            response = llm_with_tools.invoke(messages)
            messages.append(response)

            tool_calls = getattr(response, "tool_calls", None) or []
            if not tool_calls:
                reply = _extract_text_content(response.content)
                break

            for call in tool_calls:
                tool_name = call.get("name", "")
                if tool_name and tool_name not in tools_used:
                    tools_used.append(tool_name)

                tool_to_call = tools_map.get(tool_name)
                if tool_to_call is not None:
                    args = call.get("args") or {}
                    try:
                        output = tool_to_call.invoke(args)
                    except Exception as tool_err:
                        logger.warning("Erro ao executar tool %s: %s", tool_name, tool_err)
                        output = json.dumps({"error": f"Erro na execução de {tool_name}: {tool_err}"})
                else:
                    output = json.dumps({"error": f"Tool '{tool_name}' não encontrada."})

                output_text = _unwrap_tool_output_text(output)
                widget = extract_widget_from_tool_output(tool_name, output_text)
                if widget is not None:
                    widgets.append(ChatWidget.model_validate(widget))
                if tool_name == "propose_dashboard_actions":
                    parsed_ui = _parse_dashboard_actions_output(output_text)
                    if parsed_ui:
                        for act in parsed_ui["actions"]:
                            suggested_actions.append(DashboardFilterAction.model_validate(act))
                        follow_ups = parsed_ui["follow_ups"]

                call_id = call.get("id") or f"call_{len(messages)}_{tool_name}"
                messages.append(ToolMessage(content=output_text, tool_call_id=call_id))
        else:
            final_res = llm.invoke(messages)
            reply = _extract_text_content(final_res.content)
    except HTTPException:
        raise
    except Exception as err:
        status, _code, detail = _classify_provider_error(err)
        logger.warning("Erro no agente mock/síncrono (%s): %s", status, err)
        raise HTTPException(status_code=status, detail=detail) from err

    if not reply.strip():
        reply = (
            "Consulta concluída no acervo da Steam, mas o modelo retornou uma resposta vazia. "
            "Tente reformular a pergunta."
        )

    return ChatResponse(
        reply=reply,
        model=raw_model,
        tools_used=tools_used,
        trace_id=trace_id,
        suggested_actions=suggested_actions,
        follow_ups=follow_ups,
        widgets=widgets,
    )


async def stream_chat_agui(
    session: Session,
    payload: ChatRequest,
    thread_id: str | None = None,
    run_id: str | None = None,
    llm: Any | None = None,
) -> AsyncIterator[Any]:
    """Executa o agente LangChain v1 + FastMCP e emite eventos padronizados do protocolo AG-UI 1.0."""
    raw_model, primary_llm, fallback_llms = _prepare_runtime(payload, llm, streaming=True)
    effective_thread = thread_id or f"thr_{uuid.uuid4().hex[:12]}"
    effective_run = run_id or f"run_{uuid.uuid4().hex[:12]}"
    handler, trace_id = create_langfuse_handler(session_id=effective_thread)
    started_at = time.perf_counter()

    yield RunStartedEvent(
        type=EventType.RUN_STARTED,
        thread_id=effective_thread,
        run_id=effective_run,
    )

    tools_used: list[str] = []
    widgets: list[dict[str, Any]] = []
    tool_start_times: dict[str, float] = {}
    tool_names_by_run: dict[str, str] = {}
    active_text_msg_id: str | None = None
    streamed_any_text_for_model: set[str] = set()
    final_reply_chunks: list[str] = []

    try:
        if not isinstance(primary_llm, BaseChatModel):
            res = _run_sync_mock_loop(session, payload, raw_model, primary_llm, trace_id)
            for idx, tool_name in enumerate(res.tools_used):
                tc_id = f"tc_{idx}_{tool_name}"
                yield ToolCallStartEvent(
                    type=EventType.TOOL_CALL_START,
                    tool_call_id=tc_id,
                    tool_call_name=tool_name,
                )
                yield ToolCallEndEvent(type=EventType.TOOL_CALL_END, tool_call_id=tc_id)
                yield ToolCallResultEvent(
                    type=EventType.TOOL_CALL_RESULT,
                    message_id=f"tm_{tc_id}",
                    tool_call_id=tc_id,
                    content="{}",
                    role="tool",
                )
            for w in res.widgets:
                yield CustomEvent(type=EventType.CUSTOM, name="genui_widget", value=w.model_dump())
            if res.suggested_actions or res.follow_ups:
                yield CustomEvent(
                    type=EventType.CUSTOM,
                    name="dashboard_actions",
                    value={
                        "actions": [a.model_dump() for a in res.suggested_actions],
                        "follow_ups": res.follow_ups,
                        "auto_apply": False,
                    },
                )
            msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            yield TextMessageStartEvent(
                type=EventType.TEXT_MESSAGE_START,
                message_id=msg_id,
                role="assistant",
            )
            yield TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT,
                message_id=msg_id,
                delta=res.reply,
            )
            yield TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=msg_id)
            yield CustomEvent(
                type=EventType.CUSTOM,
                name="run_metadata",
                value={
                    "trace_id": trace_id,
                    "model": raw_model,
                    "tools_used": res.tools_used,
                    "latency_ms": round((time.perf_counter() - started_at) * 1000),
                    "langfuse_enabled": is_langfuse_enabled(),
                },
            )
            yield RunFinishedEvent(
                type=EventType.RUN_FINISHED,
                thread_id=effective_thread,
                run_id=effective_run,
            )
            return

        async with steam_mcp_tools(session, payload.filters) as mcp_tools:
            all_tools = [*mcp_tools, build_ui_action_tool()]
            middleware = build_agent_middleware(primary_llm, fallback_llms)
            agent = create_agent(
                model=primary_llm,
                tools=all_tools,
                system_prompt=build_system_prompt(payload.filters),
                middleware=middleware,
                name="SteamBot9000",
            )

            invoke_config: dict[str, Any] = {"recursion_limit": 24}
            if handler is not None:
                invoke_config["callbacks"] = [handler]

            lc_messages = _build_lc_messages(payload)

            async for ev in agent.astream_events(
                {"messages": lc_messages},
                version="v2",
                config=invoke_config,
            ):
                kind = ev.get("event")
                meta = ev.get("metadata") or {}
                ev_run_id = str(ev.get("run_id") or "")
                data = ev.get("data") or {}
                langgraph_node = meta.get("langgraph_node")

                if kind == "on_tool_start":
                    if active_text_msg_id is not None:
                        yield TextMessageEndEvent(
                            type=EventType.TEXT_MESSAGE_END,
                            message_id=active_text_msg_id,
                        )
                        active_text_msg_id = None

                    tool_name = str(ev.get("name") or "tool")
                    if tool_name not in tools_used:
                        tools_used.append(tool_name)
                    tool_names_by_run[ev_run_id] = tool_name
                    tool_start_times[ev_run_id] = time.perf_counter()

                    yield ToolCallStartEvent(
                        type=EventType.TOOL_CALL_START,
                        tool_call_id=ev_run_id,
                        tool_call_name=tool_name,
                    )
                    tool_input = data.get("input")
                    if tool_input is not None:
                        try:
                            args_json = (
                                tool_input
                                if isinstance(tool_input, str)
                                else json.dumps(tool_input, ensure_ascii=False, default=str)
                            )
                        except Exception:
                            args_json = "{}"
                        yield ToolCallArgsEvent(
                            type=EventType.TOOL_CALL_ARGS,
                            tool_call_id=ev_run_id,
                            delta=args_json,
                        )
                    yield ToolCallEndEvent(
                        type=EventType.TOOL_CALL_END,
                        tool_call_id=ev_run_id,
                    )

                elif kind == "on_tool_end":
                    tool_name = tool_names_by_run.pop(ev_run_id, str(ev.get("name") or "tool"))
                    t_start = tool_start_times.pop(ev_run_id, None)
                    duration_ms = round((time.perf_counter() - t_start) * 1000) if t_start else 0

                    output_text = _unwrap_tool_output_text(data.get("output"))
                    yield ToolCallResultEvent(
                        type=EventType.TOOL_CALL_RESULT,
                        message_id=f"tm_{ev_run_id}",
                        tool_call_id=ev_run_id,
                        content=output_text,
                        role="tool",
                    )
                    yield CustomEvent(
                        type=EventType.CUSTOM,
                        name="tool_timing",
                        value={
                            "tool_call_id": ev_run_id,
                            "tool_name": tool_name,
                            "duration_ms": duration_ms,
                        },
                    )

                    widget = extract_widget_from_tool_output(tool_name, output_text)
                    if widget is not None:
                        widgets.append(widget)
                        yield CustomEvent(
                            type=EventType.CUSTOM,
                            name="genui_widget",
                            value=widget,
                        )

                    if tool_name == "propose_dashboard_actions":
                        parsed_ui = _parse_dashboard_actions_output(output_text)
                        if parsed_ui is not None:
                            yield CustomEvent(
                                type=EventType.CUSTOM,
                                name="dashboard_actions",
                                value=parsed_ui,
                            )
                            if parsed_ui["auto_apply"] and parsed_ui["actions"]:
                                first_act = parsed_ui["actions"][0]
                                yield StateSnapshotEvent(
                                    type=EventType.STATE_SNAPSHOT,
                                    snapshot={
                                        "filters": first_act.get("filters") or {},
                                        "reset": bool(first_act.get("reset", False)),
                                    },
                                )

                elif kind == "on_chat_model_stream" and langgraph_node == "model":
                    chunk = data.get("chunk")
                    if chunk is None:
                        continue
                    delta = _extract_text_content(getattr(chunk, "content", ""))
                    if not delta:
                        continue
                    if active_text_msg_id is None:
                        active_text_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
                        yield TextMessageStartEvent(
                            type=EventType.TEXT_MESSAGE_START,
                            message_id=active_text_msg_id,
                            role="assistant",
                        )
                    streamed_any_text_for_model.add(ev_run_id)
                    final_reply_chunks.append(delta)
                    yield TextMessageContentEvent(
                        type=EventType.TEXT_MESSAGE_CONTENT,
                        message_id=active_text_msg_id,
                        delta=delta,
                    )

                elif kind == "on_chat_model_end" and langgraph_node == "model":
                    output_msg = data.get("output")
                    has_tool_calls = bool(getattr(output_msg, "tool_calls", None)) if output_msg else False
                    if not has_tool_calls and ev_run_id not in streamed_any_text_for_model:
                        full_text = _extract_text_content(getattr(output_msg, "content", "")) if output_msg else ""
                        if full_text.strip():
                            if active_text_msg_id is None:
                                active_text_msg_id = f"msg_{uuid.uuid4().hex[:12]}"
                                yield TextMessageStartEvent(
                                    type=EventType.TEXT_MESSAGE_START,
                                    message_id=active_text_msg_id,
                                    role="assistant",
                                )
                            final_reply_chunks.append(full_text)
                            yield TextMessageContentEvent(
                                type=EventType.TEXT_MESSAGE_CONTENT,
                                message_id=active_text_msg_id,
                                delta=full_text,
                            )

                    if active_text_msg_id is not None:
                        yield TextMessageEndEvent(
                            type=EventType.TEXT_MESSAGE_END,
                            message_id=active_text_msg_id,
                        )
                        active_text_msg_id = None

        if not "".join(final_reply_chunks).strip():
            fallback_id = f"msg_{uuid.uuid4().hex[:12]}"
            fallback_text = (
                "Consulta concluída no acervo da Steam, mas o modelo retornou uma resposta vazia. "
                "Tente reformular a pergunta."
            )
            yield TextMessageStartEvent(
                type=EventType.TEXT_MESSAGE_START,
                message_id=fallback_id,
                role="assistant",
            )
            yield TextMessageContentEvent(
                type=EventType.TEXT_MESSAGE_CONTENT,
                message_id=fallback_id,
                delta=fallback_text,
            )
            yield TextMessageEndEvent(
                type=EventType.TEXT_MESSAGE_END,
                message_id=fallback_id,
            )

        yield CustomEvent(
            type=EventType.CUSTOM,
            name="run_metadata",
            value={
                "trace_id": trace_id,
                "model": raw_model,
                "tools_used": tools_used,
                "latency_ms": round((time.perf_counter() - started_at) * 1000),
                "langfuse_enabled": is_langfuse_enabled(),
            },
        )
        yield RunFinishedEvent(
            type=EventType.RUN_FINISHED,
            thread_id=effective_thread,
            run_id=effective_run,
        )

    except HTTPException as http_err:
        if active_text_msg_id is not None:
            yield TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=active_text_msg_id)
        yield RunErrorEvent(
            type=EventType.RUN_ERROR,
            message=str(http_err.detail),
            code=f"HTTP_{http_err.status_code}",
        )
    except Exception as err:
        if active_text_msg_id is not None:
            yield TextMessageEndEvent(type=EventType.TEXT_MESSAGE_END, message_id=active_text_msg_id)
        _status, code, user_msg = _classify_provider_error(err)
        logger.exception("Erro no streaming AG-UI (%s): %s", code, err)
        yield RunErrorEvent(
            type=EventType.RUN_ERROR,
            message=user_msg,
            code=code,
        )


async def run_chat_agent_async(
    session: Session,
    payload: ChatRequest,
    llm: Any | None = None,
) -> ChatResponse:
    """Executa o agente e consolida resposta JSON compatível com POST /api/chat."""
    raw_model, primary_llm, fallback_llms = _prepare_runtime(payload, llm, streaming=False)
    trace_id = create_langfuse_handler()[1]

    if not isinstance(primary_llm, BaseChatModel):
        return _run_sync_mock_loop(session, payload, raw_model, primary_llm, trace_id)

    handler, trace_id = create_langfuse_handler()
    tools_used: list[str] = []
    widgets: list[ChatWidget] = []
    suggested_actions: list[DashboardFilterAction] = []
    follow_ups: list[str] = []

    try:
        async with steam_mcp_tools(session, payload.filters) as mcp_tools:
            all_tools = [*mcp_tools, build_ui_action_tool()]
            middleware = build_agent_middleware(primary_llm, fallback_llms)
            agent = create_agent(
                model=primary_llm,
                tools=all_tools,
                system_prompt=build_system_prompt(payload.filters),
                middleware=middleware,
                name="SteamBot9000",
            )
            invoke_config: dict[str, Any] = {"recursion_limit": 24}
            if handler is not None:
                invoke_config["callbacks"] = [handler]

            result = await agent.ainvoke(
                {"messages": _build_lc_messages(payload)},
                config=invoke_config,
            )

        out_messages = result.get("messages", []) if isinstance(result, dict) else []
        reply = ""
        for msg in out_messages:
            if isinstance(msg, ToolMessage):
                t_name = getattr(msg, "name", "") or ""
                if t_name and t_name not in tools_used:
                    tools_used.append(t_name)
                text_out = _unwrap_tool_output_text(msg)
                widget = extract_widget_from_tool_output(t_name, text_out)
                if widget is not None:
                    widgets.append(ChatWidget.model_validate(widget))
                if t_name == "propose_dashboard_actions":
                    parsed_ui = _parse_dashboard_actions_output(text_out)
                    if parsed_ui:
                        for act in parsed_ui["actions"]:
                            suggested_actions.append(DashboardFilterAction.model_validate(act))
                        follow_ups = parsed_ui["follow_ups"]
            elif isinstance(msg, AIMessage):
                content = _extract_text_content(msg.content)
                if content.strip():
                    reply = content

    except HTTPException:
        raise
    except Exception as err:
        status, _code, detail = _classify_provider_error(err)
        logger.exception("Erro no agente LangChain v1 (%s): %s", status, err)
        raise HTTPException(status_code=status, detail=detail) from err

    if not reply.strip():
        reply = (
            "Consulta concluída no acervo da Steam, mas o modelo retornou uma resposta vazia. "
            "Tente reformular a pergunta."
        )

    return ChatResponse(
        reply=reply,
        model=raw_model,
        tools_used=tools_used,
        trace_id=trace_id,
        suggested_actions=suggested_actions,
        follow_ups=follow_ups,
        widgets=widgets,
    )


def run_chat_agent(
    session: Session,
    payload: ChatRequest,
    llm: Any | None = None,
) -> ChatResponse:
    """Wrapper síncrono conveniente sobre run_chat_agent_async."""
    raw_model, primary_llm, _fallback_llms = _prepare_runtime(payload, llm, streaming=False)
    trace_id = create_langfuse_handler()[1]
    if not isinstance(primary_llm, BaseChatModel):
        return _run_sync_mock_loop(session, payload, raw_model, primary_llm, trace_id)
    return asyncio.run(run_chat_agent_async(session, payload, llm=primary_llm))
