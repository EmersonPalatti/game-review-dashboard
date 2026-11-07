from datetime import datetime
import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool, tool
from langchain_openai import ChatOpenAI
import openai
from sqlalchemy.orm import Session

from backend.app.queries import charts, list_reviews, metrics
from backend.app.schemas import (
    ChatRequest,
    ChatResponse,
    ReviewFilters,
    ReviewSortBy,
    SortDir,
)
from backend.app.transform import PLAYTIME_BUCKETS

logger = logging.getLogger(__name__)

_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def _read_dotenv_var(name: str, env_path: Path = _ENV_PATH) -> str:
    """Lê uma variável do arquivo .env na raiz do projeto caso não esteja no os.environ."""
    if not env_path.is_file():
        return ""
    try:
        for raw_line in env_path.read_text(encoding="utf-8").splitlines():
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            if key.startswith("export "):
                key = key[len("export ") :].strip()
            if key == name:
                val = val.strip()
                if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                    val = val[1:-1]
                return val.strip()
    except Exception:
        return ""
    return ""


def get_config_var(name: str, default: str = "") -> str:
    """Obtém variável de os.environ ou, durante desenvolvimento local, do arquivo .env."""
    val = os.getenv(name, "").strip()
    if val:
        return val
    # Não lê o .env real quando estiver rodando suíte do pytest
    if os.getenv("PYTEST_CURRENT_TEST"):
        return default
    dotenv_val = _read_dotenv_var(name)
    return dotenv_val if dotenv_val else default


DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

SYSTEM_PROMPT = """Você é o SteamBot-9000, o analista de dados veterano do acervo de avaliações da Steam: rigoroso com números, veterano de milhares de horas jogadas e com um humor ácido e espirituoso sobre a cultura gamer.

### Sua Personalidade e Tom:
- Analista veterano da Steam: você combina precisão estatística com observações bem-humoradas sobre os paradoxos dos jogadores — como cravar 2.000 horas em Skyrim ou Arma 3 para deixar uma review negativa dizendo "não recomendo, nada pra fazer", acumular dezenas de jogos na Summer Sale que nunca serão instalados no backlog, o drama do Acesso Antecipado eterno e a corrida contra o relógio nos 119 minutos da janela de reembolso da Valve.
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

### REGRA DE OURO (FIDELIDADE EMPÍRICA):
- SEMPRE chame as ferramentas disponíveis (`get_metrics`, `get_charts`, `get_reviews_sample`) antes de responder qualquer pergunta sobre números, porcentagens, taxas, jogos específicos, idiomas, meses ou exemplos reais de reviews.
- NUNCA invente números, estatísticas ou reviews. Se o usuário perguntar métricas, busque-as via tool no recorte atual.
- O recorte filtrado ativo no painel do usuário é informado logo abaixo. Use-o como base padrão para as consultas.
"""


def normalize_model_name(model_name: str) -> str:
    """Remove o prefixo 'openrouter/' se presente."""
    if model_name.startswith("openrouter/"):
        return model_name[len("openrouter/"):]
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

    for field_name, value in (("date_from", filters.date_from), ("date_to", filters.date_to)):
        if value is not None:
            try:
                datetime.strptime(value, "%Y-%m-%d")
            except ValueError as err:
                raise HTTPException(
                    status_code=422,
                    detail="Data inválida. Use o formato AAAA-MM-DD.",
                ) from err


def _merge_filters(
    default: ReviewFilters,
    app_id: int | None = None,
    language: str | None = None,
    recommended: bool | None = None,
    steam_purchase: bool | None = None,
    received_for_free: bool | None = None,
    early_access: bool | None = None,
    playtime_bucket: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> ReviewFilters:
    chosen_bucket = playtime_bucket if playtime_bucket is not None else default.playtime_bucket
    if chosen_bucket is not None and chosen_bucket not in PLAYTIME_BUCKETS:
        chosen_bucket = default.playtime_bucket

    return ReviewFilters(
        app_id=app_id if app_id is not None else default.app_id,
        language=language if language is not None else default.language,
        recommended=recommended if recommended is not None else default.recommended,
        steam_purchase=steam_purchase if steam_purchase is not None else default.steam_purchase,
        received_for_free=received_for_free if received_for_free is not None else default.received_for_free,
        early_access=early_access if early_access is not None else default.early_access,
        playtime_bucket=chosen_bucket,
        date_from=date_from if date_from is not None else default.date_from,
        date_to=date_to if date_to is not None else default.date_to,
    )


def build_chat_tools(session: Session, default_filters: ReviewFilters) -> list[BaseTool]:
    """Cria e retorna as 3 tools do LangChain vinculadas à sessão e aos filtros padrão do dashboard."""

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
        """Obtém as métricas gerais agregadas dos reviews da base (total de avaliações, taxa de recomendação, quantidade de jogos e autores únicos, top jogos e top idiomas).
        Parâmetros opcionais para filtrar:
        - app_id: ID numérico do jogo.
        - language: Idioma dos reviews (ex: 'english', 'brazilian', 'schinese').
        - recommended: True para positivas, False para negativas.
        - steam_purchase: True para compras na Steam.
        - received_for_free: True se recebido gratuitamente.
        - early_access: True para reviews escritas durante Acesso Antecipado.
        - playtime_bucket: Faixa de horas ('lt1', 'h1_2', 'h2_5', 'h5_10', 'h10_25', 'h25_50', 'h50_100', 'h100_500', 'gte500').
        - date_from: Data inicial (AAAA-MM-DD).
        - date_to: Data final (AAAA-MM-DD).
        """
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
        """Obtém dados para visualização de gráficos: distribuição por faixas de tempo de jogo (playtime), jogos mais avaliados, distribuição por idiomas e evolução mensal.
        Parâmetros opcionais para filtrar:
        - app_id: ID do jogo.
        - language: Idioma dos reviews.
        - recommended: True para positivas, False para negativas.
        - steam_purchase: True para compras na Steam.
        - received_for_free: True se recebido gratuitamente.
        - early_access: True para Acesso Antecipado.
        - playtime_bucket: Faixa de horas ('lt1', 'h1_2', 'h2_5', etc.).
        - date_from: Data inicial (AAAA-MM-DD).
        - date_to: Data final (AAAA-MM-DD).
        """
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
        """Obtém uma amostra de reviews individuais com trecho do texto, horas jogadas na data do review, se recomendou, votos úteis, votos engraçados e data.
        Parâmetros:
        - limit: Número de reviews a retornar (entre 1 e 10, padrão 5).
        - sort_by: Ordenar por 'votes_helpful', 'created_at' ou 'playtime_hours' (padrão 'votes_helpful').
        - sort_dir: Direção da ordenação 'desc' ou 'asc' (padrão 'desc').
        - Filtros opcionais adicionais: app_id, language, recommended, steam_purchase, received_for_free, early_access, playtime_bucket, date_from, date_to.
        """
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

    return [get_metrics, get_charts, get_reviews_sample]


def _extract_text_content(content: Any) -> str:
    """Extrai string a partir de string ou lista de blocos do LangChain."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                parts.append(part.get("text", ""))
        return "".join(parts)
    return str(content) if content is not None else ""


def run_chat_agent(
    session: Session,
    payload: ChatRequest,
    llm: Any | None = None,
) -> ChatResponse:
    """Executa o agente conversacional com suporte a tool-calling e OpenRouter."""
    if not payload.message.strip():
        raise HTTPException(
            status_code=422,
            detail="A mensagem não pode estar vazia.",
        )

    validate_chat_filters(payload.filters)

    raw_model = get_config_var("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL) or DEFAULT_OPENROUTER_MODEL
    normalized_model = normalize_model_name(raw_model)

    if llm is None:
        api_key = get_config_var("OPENROUTER_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail=(
                    "A variável de ambiente OPENROUTER_API_KEY não está configurada no servidor. "
                    "Configure sua chave gratuita do OpenRouter para conversar com o robô!"
                ),
            )
        llm = ChatOpenAI(
            base_url=OPENROUTER_BASE_URL,
            api_key=api_key,
            model=normalized_model,
            temperature=0.4,
            max_tokens=900,
        )

    tools = build_chat_tools(session, payload.filters)
    tools_map = {t.name: t for t in tools}
    llm_with_tools = llm.bind_tools(tools)

    system_content = build_system_prompt(payload.filters)
    messages: list[BaseMessage] = [SystemMessage(content=system_content)]

    for item in payload.history:
        if item.role == "user":
            messages.append(HumanMessage(content=item.content))
        elif item.role == "assistant":
            messages.append(AIMessage(content=item.content))

    messages.append(HumanMessage(content=payload.message))

    tools_used: list[str] = []
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

                call_id = call.get("id") or f"call_{len(messages)}_{tool_name}"
                messages.append(
                    ToolMessage(
                        content=str(output),
                        tool_call_id=call_id,
                    )
                )
        else:
            final_res = llm.invoke(messages)
            reply = _extract_text_content(final_res.content)

    except openai.AuthenticationError as err:
        logger.error("Erro de autenticação OpenRouter: %s", err)
        raise HTTPException(
            status_code=502,
            detail="Chave de API do OpenRouter inválida ou não autorizada. Verifique a chave OPENROUTER_API_KEY.",
        ) from err
    except openai.RateLimitError as err:
        logger.warning("Limite de requisições OpenRouter atingido: %s", err)
        raise HTTPException(
            status_code=503,
            detail="Limite de requisições da OpenRouter atingido. Por favor, aguarde alguns instantes e tente novamente.",
        ) from err
    except openai.APIConnectionError as err:
        logger.error("Falha de conexão com OpenRouter: %s", err)
        raise HTTPException(
            status_code=502,
            detail="Não foi possível conectar aos servidores da OpenRouter. Verifique sua conexão com a internet.",
        ) from err
    except openai.BadRequestError as err:
        logger.error("Requisição inválida para OpenRouter: %s", err)
        raise HTTPException(
            status_code=502,
            detail=f"Requisição não aceita pelo provedor do modelo: {err}",
        ) from err
    except openai.OpenAIError as err:
        logger.error("Erro na API OpenRouter: %s", err)
        raise HTTPException(
            status_code=502,
            detail=f"Erro no serviço de inteligência artificial: {err}",
        ) from err
    except HTTPException:
        raise
    except Exception as err:
        logger.exception("Erro inesperado no agente de chat: %s", err)
        raise HTTPException(
            status_code=500,
            detail=f"Erro interno ao processar a conversa: {err}",
        ) from err

    if not reply.strip():
        reply = (
            "Consulta concluída no acervo da Steam, mas o modelo retornou uma resposta vazia. "
            "Tente reformular a pergunta."
        )

    return ChatResponse(
        reply=reply,
        model=raw_model,
        tools_used=tools_used,
    )
