# Roteiro · SteamBot-9000 v2 (motion vídeo para o LinkedIn)

Fonte das melhorias: PR #2 (`feature/chat-agent-v2`, já mergeado em `origin/main`).
Todo número que aparece na tela está listado em [De onde vem cada número](#de-onde-vem-cada-número).

## Formato

| Item | Escolha | Motivo |
| :--- | :--- | :--- |
| Canvas | **1080 × 1350** (4:5, vertical) | É o formato que ocupa mais tela no feed do celular sem ser cortado. 1920×1600 não é um tamanho padrão do LinkedIn. |
| fps | 60 | Igual ao `Overview`, ao `Showcase` e ao motor de captura. |
| Duração | 49,8 s (2.988 frames) | 8 cenas com transições de 6 frames (`OVERLAP_FRAMES`). Cada cena segura o estado final para dar tempo de leitura no mudo. |
| Linguagem | Híbrida | Motion graphics explica a arquitetura (estilo `Overview`). Tomadas reais do chat provam que funciona (estilo `Showcase`). |
| Áudio | Sem locução. Trilha baixa e 3 efeitos | O feed do LinkedIn toca sem som. O vídeo precisa ser entendido no mudo. |

### Grade da tela (4:5)

- Margem lateral: 72 px.
- Zona do título (y 96–330): kicker mono 26 px em `textMuted` e headline 64 px, no máximo 2 linhas.
- Zona de conteúdo (y 360–1110): diagrama ou tomada real.
- Linha do porquê (y 1130–1200): 32 px em `textSecondary`, uma frase só.
- Base (y 1200–1350): livre, porque o player do LinkedIn sobrepõe controles ali.
- Texto mínimo de 24 px. Nenhum parágrafo na tela.

Cores de `src/overview/theme.ts`: vermelho `#E5484D` para limite do v1, âmbar `#E5A000` para ferramenta executando, esmeralda `#3ECF8E` para ganho do v2.

## Tese

> Não trocamos só o modelo. O chat virou um agente que enxerga o catálogo inteiro, lê o texto das reviews, mostra o que está fazendo e passa por teste.

Toda cena segue o mesmo padrão: a headline diz o que mudou, a linha de baixo diz por que precisava mudar.

## Linha do tempo

| # | Cena | Tipo | Frames | Tempo |
| :-: | :--- | :--- | :--- | :--- |
| 0 | Gancho | Real | 0 → 210 | 0:00.0 – 0:03.5 |
| 1 | O teto do v1 | Real + motion | 204 → 594 | 0:03.4 – 0:09.9 |
| 2 | Motor resiliente | Motion | 588 → 978 | 0:09.8 – 0:16.3 |
| 3 | Catálogo inteiro + MCP | Motion | 972 → 1362 | 0:16.2 – 0:22.7 |
| 4 | Busca híbrida | Motion + real | 1356 → 1776 | 0:22.6 – 0:29.6 |
| 5 | O agente trabalhando | Real | 1770 → 2340 | 0:29.5 – 0:39.0 |
| 6 | Prova | Motion | 2334 → 2724 | 0:38.9 – 0:45.4 |
| 7 | Fechamento | Motion | 2718 → 2988 | 0:45.3 – 0:49.8 |

## Cena a cena

### Cena 0 · Gancho (3,5 s · real)

O resultado aparece no primeiro segundo, antes de qualquer explicação.

- Tela: close no painel do chat v2 (tomada T2). A resposta chega em streaming e o widget comparativo desliza dentro da bolha. Push-in lento da câmera (1,0 → 1,06).
- Kicker: `STEAMBOT-9000 · v1 → v2`
- Headline: **Reconstruímos o chat do dashboard.**
- Sem linha do porquê.

### Cena 1 · O teto do v1 (6,5 s · real + motion)

- Tela: tomada T0 do v1 na metade de cima da zona de conteúdo, em três cortes e tudo em 1×: o loader logo após o envio (até 2,4 s), os segundos finais da espera (22,4 s → 24,4 s, com o selo `corte · 20 s depois`) e a resposta chegando inteira. O contador do próprio loader mostra o tempo real. Carimbo `v1 · tomada real` no canto.
- Headline: **O v1 respondia. Mas batia no teto.**
- Etiquetas vermelhas empilhadas abaixo da tomada, uma a cada 0,5 s:
  1. `Etapas do loading por cronômetro`
  2. `Enxergava 10 dos 59 jogos`
  3. `Não buscava no texto das reviews`
  4. `1 modelo, 900 tokens, sem plano B`
- No final a tomada escurece 40% e as etiquetas continuam na tela.
- Porquê: *O limite estava na arquitetura, não no prompt.*
- Se T0 não sair: recriar o loader em motion (três linhas mono de "SQL" rolando e uma barra de 2,2 s) com o selo `simulado`.

### Cena 2 · Motor resiliente (6,5 s · motion)

- Kicker: `LANGCHAIN v1 · create_agent`
- Headline: **Se um modelo cai, o próximo assume.**
- Diagrama vertical com 4 cartões de modelo empilhados:
  `nvidia/nemotron-3.5-super-vl:free` (principal) → `inclusionai/ling-3.2-flash:free` → `nvidia/nemotron-3.5-lightning:free` → `openrouter/free`
  - Um pulso desce até o principal, que pisca `429` em vermelho. O feixe desvia para o cartão seguinte, que acende em esmeralda com `200 OK`. É um diagrama do comportamento do `ModelFallbackMiddleware`, não um log real.
- Abaixo dos cartões, um contador: `900 → 2.048` tokens de resposta.
- Faixa com os 5 middlewares: `Fallback` · `Retry` · `Limite de 8 tools` · `Erro de tool` · `Resumo de contexto`
- Pill no fim da zona de conteúdo: `$0 de API`
- Porquê: *Modelo de raciocínio gasta token pensando. Com 900, a resposta podia sair cortada.*

### Cena 3 · Catálogo inteiro + MCP (6,5 s · motion)

- Kicker: `FASTMCP · 7 FERRAMENTAS`
- Headline: **De 10 para 59 jogos.**
- Beat 1 (0 – 2,5 s): grade com 59 pontos em 8 colunas. 10 acesos em cinza claro e 49 apagados, com a legenda `49 fora do alcance do v1`. Uma onda acende todos em esmeralda e o contador vai de `10` a `59`.
- Beat 2 (2,5 – 5,5 s): a grade sobe e encolhe. Entram as ferramentas com os rótulos que a própria UI usa (`TOOL_LABELS` em `ChatGenUI.tsx`):
  - já existiam (cinza): `KPIs & Rankings`, `Séries & Playtime`, `Amostra de Reviews`
  - novas (esmeralda): `Catálogo (59 jogos)`, `Engajamento`, `Comparativo A vs B`, `Busca Híbrida (FTS5 + Vetor)`
  - Duas ganham uma nota curta: `Comparativo A vs B` com "diferença em p.p. numa chamada só" e `Engajamento` com "negativas recebem 2,8× mais votos úteis".
  - Uma moldura `FastMCP · SteamReviewsAnalytics` fecha em volta das 7. Nota pequena: "o mesmo servidor atende outros clientes MCP".
- Porquê: *Fora do top 10, o v1 só achava o jogo se ele já estivesse filtrado no painel.*

### Cena 4 · Busca híbrida (7 s · motion + real)

- Kicker: `BUSCA HÍBRIDA · RRF`
- Headline: **Agora ele busca dentro do texto.**
- Beat 1 (0 – 1,5 s): a pergunta da tomada T1 se digita em mono: "O que os jogadores de Arma 3 falam sobre crashes e otimização?"
- Beat 2 (1,5 – 4 s): duas trilhas empilhadas acendem juntas.
  - `Palavra exata · FTS5 BM25`, com contador até `998.533 reviews`. Os termos destacados (`crash`, `FPS`, `travamento`, `lag`) são os da consulta real de T1.
  - `Significado · vetores locais (FastEmbed)`, com `11.881 reviews amostradas` e o selo `embedding local · $0`.
  - As duas trilhas convergem num nó `RRF`.
- Beat 3 (4 – 6,5 s): corte para T1, close no widget de evidências (Busca Híbrida em 144 ms, 10 evidências, trechos em vários idiomas) com uma panorâmica lenta para baixo.
- Porquê: *O v1 só via as reviews mais votadas. O tema certo podia estar fora delas.*

### Cena 5 · O agente trabalhando (9,5 s · real, clímax)

- Kicker: `AG-UI 1.0 · STREAMING`
- Headline fixa: **Você vê o agente trabalhar.**
- Tomada T2 inteira em 1×, na ordem real da execução, com um callout por momento:
  - 5a (0 – 1,5 s): a timeline de ferramentas fechando (`Catálogo` ×2 em 7 ms, `Comparativo A vs B` em 244 ms). Callout: `ferramentas e tempos reais`
  - 5b (1,5 – 3 s): o widget comparativo entrando (90,40% × 85,91%, +4,5 p.p.). Callout: `gráfico na resposta · 5 tipos de widget`
  - 5c (3 – 6 s): o texto chegando e o chat rolando. Quando o texto começa, a câmera passa (com dissolve) para um enquadramento acima do widget, porque cada linha nova empurra o widget para baixo. Callout: `resposta em streaming`
  - 5d (6 – 9,5 s): tela dividida na mesma tomada. Em cima, o cursor clica em `Foco em NieR: Automata` e aparece o `Desfazer`; embaixo, os KPIs do painel mudam (1.000.000 → 81.110 avaliações, 82,97% → 85,91%). Callout: `1 clique no painel, com desfazer`
- Porquê (entra em 5a e fica até o fim): *Sai o loading simulado. Entra o que de fato está acontecendo.*

### Cena 6 · Prova (6,5 s · motion)

- Kicker: `PYTEST · DEEPEVAL · LANGFUSE`
- Headline: **Upgrade que se mede.**
- Quatro números empilhados, um a cada 0,4 s, em `tabular-nums` esmeralda:
  - `76` testes offline passando
  - `267` eventos AG-UI numa conversa ao vivo, `0` erros
  - `2` métricas de eval ao vivo: ToolCorrectness e Faithfulness
  - `$0` em LLM e embeddings
- Linha pequena abaixo: "Traces no Langfuse e 👍/👎 ligado a cada resposta." Usar os ícones de polegar do Lucide, não emoji.
- Porquê: *Em dashboard, número inventado é o pior bug.*

### Cena 7 · Fechamento (4,5 s · motion)

- Três linhas centralizadas, escalonadas no ritmo da `Scene6_Conclusion`:
  - `Não foi troca de modelo.` (`textSecondary`)
  - `Foi uma arquitetura nova de agente.` (`text`)
  - `Catálogo inteiro. Busca no texto. Processo à vista.` (esmeralda)
- Hairline e pills: `LangChain v1` · `FastMCP` · `FTS5 + sqlite-vec` · `AG-UI` · `Langfuse` · `DeepEval`
- Rodapé: `SteamBot-9000 v2 · 998.533 reviews da Steam · 59 jogos`
- Os últimos 1,5 s ficam parados e servem de capa do post.

## Áudio (mínimo)

- Sem locução e sem legenda. O texto da tela já carrega o roteiro.
- Trilha: `public/audio/lofi2_bg.mp3` em volume 0,12 (o `Showcase` usa 0,28), com fade-in de 1 s e fade-out nos últimos 2 s.
- Só 3 efeitos: `tap.wav` quando o widget entra (5b), `click.wav` no clique do chip (5d) e `whoosh.wav` baixo na entrada do fechamento. Frames em `src/chatUpgrade/ChatUpgradeAudio.tsx`.

## Tomadas reais

T0 foi gravada em `8276d49` (chat v1), antes de atualizar o `main` para `b417a77` (PR #2). T1 e T2 foram gravadas no v2.

| Tomada | Versão | Pergunta | O que precisa aparecer | Usada em |
| :--- | :--- | :--- | :--- | :--- |
| T0 `chat-v1.mp4` | v1 (`8276d49`) | "Do que reclamam os jogadores com 500 h+ que reprovaram Arma 3?" | loader por cronômetro com ticker SQL, 24,4 s de espera real e resposta inteira de uma vez | Cena 1 |
| T1 `chat-v2-search.mp4` | v2 | "O que os jogadores de Arma 3 falam sobre crashes e otimização?" | `Catálogo` e `Busca Híbrida` na timeline, widget de evidências com trechos | Cena 4 |
| T2 `chat-v2-compare.mp4` | v2 | "Compare Arma 3 com NieR: Automata e sugira um filtro no painel para eu explorar o NieR" | `Comparativo A vs B` na timeline, widget comparativo, chip de filtro e `Desfazer` | Cenas 0 e 5 |

O modelo grátis não responde sempre igual. Repita a pergunta até sair a execução com as ferramentas certas e o chip de filtro. A resposta escolhida não é editada.

### Configuração da captura (`capture/engine.ts`)

- Viewport de 1920×1080 CSS. Acima de 1440 px o chat fica acoplado à direita com 420 px de largura.
- `scale: 2`, gerando vídeo de 3840×2160. O painel do chat sai com 840 px de largura e cabe na zona de conteúdo quase sem redimensionar. O texto do chat fica com 26 a 28 px na tela final.
- Tema escuro. Cursor visível só no beat 5d.
- `engine.mark()` em `ask`, `first-tool`, `first-token`, `widget`, `chip`, `kpi-update` e `undo`, para o Remotion sincronizar os callouts pelo `timeline.json`, do jeito que o `showcaseTiming.ts` já faz.

### Como foi gravado

- As respostas reais foram gravadas antes com `capture/record-stream.ts` (SSE de `/api/chat/stream` com o tempo de cada pedaço, em `capture/fixtures/`). Na captura, `capture/chat-takes.ts` reproduz esse stream dentro da página com timers do relógio virtual, então ritmo e conteúdo são os da execução real.
- O relógio da página fica pausado entre quadros (`pauseClock`); o contador do v1 mostra os 24,4 s reais.
- A espera do v1 vira um corte (o relógio anda 18 s sem gravar) em vez de um acelerado. Trechos acelerados que sobram nas tomadas aparecem no vídeo com o selo de velocidade.
- **Texto tremendo (corrigido):** o chat chama `scrollIntoView({ behavior: 'smooth' })` a cada token e, no Chrome headless, essa rolagem acontece num salto por linha. A captura troca isso por uma mola criticamente amortecida movida pelo relógio virtual (`capture/chat-replay.ts`): mesmo destino, movimento contínuo. O script vai como texto puro porque o `tsx` injeta `__name()` nas funções e isso quebrava o patch dentro da página.
- O v1 foi regravado a partir de uma worktree em `8276d49` (frontend na porta 4322, `APP_URL_V1`), com os dados vindos do backend atual. A worktree foi removida depois.
- **Proxies:** `npm run proxies:chat` recorta das tomadas 4K só o painel do chat (440×1080 CSS) e os KPIs (640×280 CSS), em H.264 com GOP curto, para `public/chat/`. A pré-visualização do Studio fica fluida e a renderização sai bem mais rápida.
- A busca híbrida foi gravada com o servidor aquecido: na primeira chamada o FastEmbed carrega o modelo (46 s), o que não representa o uso normal.
- T2 levou várias tentativas. Perguntas em "português" fizeram o modelo filtrar `portuguese` (Portugal) e rotular como pt-BR, e algumas respostas repetiam o texto inteiro depois de `propose_dashboard_actions` (bug do v2, ver abaixo). A tomada usada é uma execução sem edição, com rótulo e filtro do chip coerentes.

### Bug encontrado durante a gravação

Quando o modelo escreve a resposta, chama `propose_dashboard_actions` e escreve de novo, o `ChatIsland` junta os dois blocos `TEXT_MESSAGE` na mesma bolha e a tabela aparece duas vezes. Não entrou no vídeo, mas vale corrigir (por exemplo, separar a bolha a cada `TEXT_MESSAGE_START` ou instruir o modelo a chamar a ferramenta antes de escrever).

## De onde vem cada número

| Na tela | Fonte |
| :--- | :--- |
| 10 → 59 jogos | v1: `games[:10]` em `get_metrics` e `get_charts` no `chat.py` antigo. v2: `resolve_game` com o catálogo completo. |
| 3 → 7 ferramentas | `@tool` no `chat.py` antigo; `@mcp.tool()` em `backend/app/mcp_server.py` |
| 900 → 2.048 tokens | `max_tokens` no `chat.py` antigo e no atual |
| 4 modelos grátis | modelo padrão e `DEFAULT_FALLBACK_MODELS` em `backend/app/chat.py` |
| 5 middlewares, limite de 8 tools | `build_agent_middleware` em `backend/app/chat.py` (`ToolCallLimitMiddleware(run_limit=8)`) |
| Etapas por cronômetro | `thinkingStage` muda em 2,2 s e 5,5 s (`loadingElapsedMs`) no `ChatIsland.tsx` do v1 |
| v1 sem busca no texto | v1 só tinha `get_reviews_sample`, ordenado por votos, data ou playtime |
| 998.533 e 11.881 | `scripts/build_search_index.py --vec-limit 12000`, rodado na thread do upgrade |
| 5 tipos de widget | tipo `GenUIWidget` em `frontend/src/lib/chatStream.ts` |
| 76 testes | `uv run pytest -v`, antes e depois do merge com `main` |
| 267 eventos, 0 erros | teste ao vivo de `POST /api/chat/stream` com `nemotron-3.5-super-vl:free` |
| ToolCorrectness + Faithfulness | `backend/tests/evals/test_chat_evals.py`, `uv run pytest -m eval` (1 passed) |
| 2,8× votos úteis | base global, 3,70 contra 1,32 (`analysis.ipynb`, citado no system prompt do `chat.py`) |
| Langfuse | `backend/app/observability.py`; liga quando as chaves estão no `.env` |
| Tempos em ms da Cena 5 | os que a UI mostrar na tomada real, nunca digitados à mão |

## Implementação no Remotion (próximo passo)

- Nova composição `ChatUpgrade` em `src/Root.tsx`: 1080×1350, 60 fps, 2.538 frames.
- Arquivos novos: `src/ChatUpgrade.tsx` e `src/chatUpgrade/scenes/Scene0…Scene7`.
- Reaproveitar `overview/theme.ts`, `SceneTransition` com `OVERLAP_FRAMES`, `Callout`, `Cursor` e `AudioLayer`. O `AudioLayer` hoje fixa a trilha em 0,28 e precisa receber o volume por prop.
- As cenas do `Overview` foram desenhadas em coordenadas de 1920×1080. As do `ChatUpgrade` são novas, pensadas para 4:5.
- Script `render:chat-upgrade` gerando `../assets/chat-upgrade.mp4`, e a capa com `remotion still` no frame 2.500.
