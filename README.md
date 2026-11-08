# Steam Reviews Dashboard & Análise Exploratória (1M de Reviews)

> 🚀 **Deploy em Produção (Live Demo):** **[game-review-dashboard-sage.vercel.app](https://game-review-dashboard-sage.vercel.app/)**  
> ⚡ *Frontend estático global na **Vercel** (Astro + React Islands), API de agregação no **Render** (FastAPI com DuckDB em memória, LRU Cache e Baseline) e banco **PostgreSQL** gerenciado no **Supabase** (1.000.000 de avaliações).*

Painel analítico interativo e estudo de dados sobre **1.000.000 de avaliações da Steam** (março de 2013 a janeiro de 2021), derivado do [Game Reviews Dataset no Kaggle](https://www.kaggle.com/datasets/sridharstreaks/game-reviews-dataset). A base cobre **59 jogos** e **912.553 autores únicos**.

O projeto reúne duas entregas integradas:
1. **Dashboard operacional de filtragem cruzada** (Astro, React Islands, TanStack Query, TanStack Table + TanStack Virtual, Apache ECharts, Nanostores, Tailwind CSS v4 e FastAPI com SQLite local / PostgreSQL em produção) para exploração interativa em tempo real com recortes multidimensionais, KPIs dinâmicos, gráficos reativos e listagem virtualizada de avaliações com rolagem infinita.
2. **Análise exploratória de dados e auditoria relacional** (`analysis.ipynb`), conduzida com o Gemini 4 Argon e subagentes Gemini 3.8 Flash (`AGENTS.md`), auditando as 4 partições relacionais 1:1, saneando anomalias extremas (como underflow de `uint32` e spams de copypasta) e investigando a dinâmica de recomendação e tempo de jogo.

[![Demonstração do Dashboard e Análise](assets/overview.gif)](assets/overview.mp4)

> 🎬 **Vídeos demonstrativos em alta definição (60 FPS):**
> - 📺 [**Showcase Completo do Dashboard (`assets/showcase.mp4`)**](assets/showcase.mp4) — Tour interativo de 62s com zoom e clique no gráfico mensal, filtro de período, filtragem cruzada em tempo real, rankings, presets analíticos, alternância de tema e experiência mobile.
> - 📊 [**Visão Geral & Metodologia (`assets/overview.mp4`)**](assets/overview.mp4) — Resumo executivo dos desafios, arquitetura de dados e conclusões de negócio.

---

## Sumário

- [1. Recursos do Dashboard](#1-recursos-do-dashboard)
- [2. Arquitetura da Solução](#2-arquitetura-da-solução)
- [3. Metodologia do Experimento e Agentes](#3-metodologia-do-experimento-e-agentes)
- [4. Estrutura do Repositório](#4-estrutura-do-repositório)
- [5. Modelagem Relacional e Saneamento de Dados](#5-modelagem-relacional-e-saneamento-de-dados)
- [6. Principais Descobertas de Negócio](#6-principais-descobertas-de-negócio)
- [7. Como Executar o Projeto](#7-como-executar-o-projeto)
- [8. Stack Tecnológica](#8-stack-tecnológica)
- [9. Autor](#9-autor)

---

## 1. Recursos do Dashboard

O painel foi projetado para permitir que analistas, engenheiros e recrutadores técnicos inspecionem os dados reais higienizados com tempo de resposta imediato, sem precisar rodar o notebook manualmente:

- **Filtragem cruzada multidimensional (8 dimensões)**: Recorte simultâneo por jogo (`app_id`), idioma (`language`), status de recomendação (`recommended`), compra direta na loja Steam (`steam_purchase`), jogo recebido gratuitamente (`received_for_free`), avaliações em Acesso Antecipado (`early_access`), faixa de horas jogadas na publicação (`playtime_bucket`) e **intervalo de datas / período temporal** (`date_from` e `date_to`).
  - **Seletor de período com calendário**: componente de intervalo de datas com atalhos anuais rápidos (2018, 2019, 2020), popover de calendário interativo com navegação rápida de ano/mês, validação contra os limites da base (05/03/2013 a 23/01/2021) e chips dinâmicos no cabeçalho.
- **Sincronização reativa de métricas e gráficos interativos**:
  - **4 KPIs em tempo real**: total de avaliações, taxa global de recomendação com comparativo contra a média, jogos distintos e contas de autores no recorte.
  - **Evolução temporal com zoom e filtro por clique (ECharts)**: série mensal de volume com controle deslizante `dataZoom`, destaque automático do pico histórico e **interatividade bidirecional**: clique em qualquer mês diretamente na linha para filtrar todo o dashboard por aquele mês. Ao filtrar um mês específico, a série temporal preserva a curva histórica de contexto com linha pontilhada de referência (`markLine`) e marcador destacado (`month-selected`), enquanto os outros painéis detalham o mês selecionado. Um novo clique no mês limpa o recorte.
  - **Taxa de aprovação por faixa de horas com filtro por clique (ECharts)**: visualização da inflexão na janela de reembolso de 2 horas da Valve, com linha de referência de aprovação global e alternância interativa de filtro ao clicar diretamente em qualquer barra.
  - **Rankings bidirecionais**: Top jogos por volume de avaliações e ranking de aprovação por idioma com badges percentuais e barras de progresso proporcionais.
  - **Tabela virtualizada com Infinite Scroll (TanStack Table + TanStack Virtual)**: renderização sob demanda apenas das linhas visíveis no viewport, rolagem contínua em janelas de 100 avaliações com cache assíncrono (TanStack Query), ordenação dinâmica por horas jogadas, votos úteis ou data de publicação, além de expansão de linhas para inspeção detalhada de badges e metadados completos (votos engraçados higienizados, pontuação ponderada da Steam, comentários e decomposição de horas jogadas).
- **Achados do estudo**: seção no topo do painel com as conclusões do notebook, ao lado do chat quando ele está aberto. A barra lateral traz o link "Como a base foi auditada", que abre o repositório da análise original ([game-review](https://github.com/EmersonPalatti/game-review#readme)).
- **Presets guiados por hipóteses da pesquisa**: atalhos na barra de contexto para carregar recortes emblemáticos:
  - *Janela < 1 h*: avaliações precoces (aprovação cai para 49,6%).
  - *Acesso antecipado*: impacto de jogos em desenvolvimento (69,8% vs. 83,8% no lançamento).
  - *Economia da insatisfação*: avaliações negativas (recebem 2,8x mais votos úteis).
- **Assistente Conversacional de IA (SteamBot-9000)**: Agente analítico sênior com inteligência contextual e humor técnico empírico integrado diretamente ao dashboard (`ChatIsland`, `client:load`) e acoplado ao endpoint `POST /api/chat`:
  - **Persona e Inteligência de Domínio**: Configurado como um Analista de Dados Sênior da Steam com humor seco e empírico, explorando as 1M de avaliações, a regra dos 119 minutos da Valve, bugs de Early Access e o backlog da Summer Sale — sem clichês infantis de robô ("Beep boop" ou saudações genéricas).
  - **Tool-calling em tempo real e Telemetria em 3 Estágios**: O agente consome o recorte exato de filtros ativos no dashboard e invoca dinamicamente ferramentas de dados (`get_metrics`, `get_charts`, `get_reviews_sample`). Durante a consulta, exibe telemetria transparente com **4×4 Matrix Dot Scanner** (`scan` mineral), **barra de progresso segmentada em 3 passos** (`1/3 Lendo filtros`, `2/3 Agregações no SQLite`, `3/3 Síntese estatística`) e **SQL Live Ticker** em tempo real com numerais tabulares em `IBM Plex Mono`.
  - **Co-piloto Analítico Bidirecional**: Detecta jogos, status de Early Access, sentimento e faixas de horas nas respostas do bot e oferece chips acionáveis que aplicam ou removem filtros no dashboard em tempo real via Nanostores, sincronizados com a URL.
  - **Tabelas GFM e Modo Amplo de Inspeção (680px)**: Suporte completo a tabelas GitHub Flavored Markdown com colunas numéricas alinhadas à direita em `IBM Plex Mono` com `tabular-nums` e botão de expansão do drawer (`440px` ↔ `680px`) para leitura comparativa confortável.
  - **Unified Command Composer (Padrão Linear / Claude)**: Caixa de digitação unificada com foco compartilhado `:focus-within`, `<textarea>` autoexpansível (com limite seguro), dicas de atalho (`Enter` envia, `Shift+Enter` quebra linha, `↑` recupera o último prompt) e botão Enviar/Parar com estado ativo mineral e controle de interrupção (`AbortController`).
  - **Coreografia de Vida Cinética (`transitions-dev`)**:
    - *Editorial Staggered Block Reveal*: Respostas recém-chegadas revelam parágrafos, listas e tabelas em cascata suave (`340ms var(--ease)` com delay escalonado de 65ms por bloco), evitando despejo visual abrupto (*block dump*).
    - *Saída Suave do Drawer*: Fechamento coreografado (`220ms` com deslize e *cross-blur*) ao clicar no `X`, backdrop ou teclar `Esc` / `Ctrl+K`.
    - *Micro-física Tátil*: Checkmark SVG com animação de traço (`stroke-dashoffset`) nos chips do co-piloto, *shake* percussivo no Composer ao tentar enviar vazio e *soft swap* na barra de contexto quando filtros externos mudam.
    - *Presença no FAB*: Pop elástico no indicador de status e aceno do ícone sincronizados com a rotação de teasers estatísticos a cada 7 segundos.
    - *Acessibilidade total*: Zero anti-padrões detectados (`impeccable detect` = `[]`) e desativação rigorosa de animações sob `@media (prefers-reduced-motion: reduce)`.
- **Usabilidade, acessibilidade e feedback visual**:
  - Feedback visual anti-flicker: indicador de carregamento progressivo com utilitário `useDelayedFlag` (tolerância de 150 ms) para transições suaves sem piscadas em leituras de cache instantâneas.
  - Alternância instantânea de tema claro e escuro persistida no armazenamento local.
  - Atalhos de teclado e acessibilidade: `/` foca a seleção de jogo na barra lateral, `Esc` fecha painéis, seletores e a gaveta móvel, além de atributos ARIA e suporte a navegação por teclado.
  - Chips de filtros ativos com remoção individual ou limpeza global em um clique, sincronizados bidirecionalmente com a URL (`history.pushState` / `replaceState`).

---

## 2. Arquitetura da Solução

O sistema adota uma separação limpa entre processamento de dados, API de agregação e apresentação reativa no frontend:

```mermaid
flowchart LR
    subgraph Dados ["Camada de Dados"]
        CSV["4 CSVs Kaggle (1M Linhas)"] --> SEED["Script de Ingestão e Limpeza\n(backend/app/seed.py)"]
        SEED --> SQLITE[("SQLite local\n(backend/data/reviews.db)")]
        SQLITE -->|"scripts/migrate_sqlite_to_pg.py"| PG[("PostgreSQL / Supabase\n(produção)")]
    end

    subgraph Backend ["Backend (FastAPI)"]
        SQLITE --> REPO["Consultas Agregadas, Filtros e Cache LRU\n(backend/app/queries.py + baseline.json)"]
        PG -.->|"DATABASE_URL"| REPO
        REPO --> API["Endpoints REST (/api/summary, /api/charts, /api/facets, /api/reviews)\n(backend/app/main.py)"]
        REPO <--> AGENT["Agente SteamBot-9000 (LangChain + OpenRouter)\n(backend/app/chat.py)"]
        AGENT --> CHAT_API["Endpoint Conversacional (/api/chat)"]
    end

    subgraph Frontend ["Frontend (Astro + React Islands)"]
        API --> QUERY["TanStack Query (Cache & Infinite)\n(QueryRoot / queryClient)"]
        CHAT_API <--> CHAT_ISLAND["ChatIsland (client:load)\nSteamBot-9000 (Tool Calling & Teasers)"]
        STORE["Estado Global Reativo\n(Nanostores: filters.ts)"] <--> QUERY
        STORE <--> CHAT_ISLAND
        STORE <--> FILTERS["Filters & Context Islands (client:load)\nControles, Calendário e Presets"]
        QUERY --> KPIS["MetricsIsland (client:load)\n4 KPI Cards"]
        QUERY --> CHARTS["ChartsIsland (client:visible)\nApache ECharts 6 (Zoom & Click-to-Filter)"]
        QUERY --> TABLE["ReviewsIsland (client:visible)\nTanStack Table + Virtual"]
    end
```

### Arquitetura de Frontend: Ilhas Reativas e Cache Desacoplado

O frontend adota uma abordagem híbrida moderna de alto desempenho:
- **Astro & React Islands (`@astrojs/react`)**: A casca da aplicação (layout, sidebar estrutural, cabeçalho) é gerada estaticamente pelo Astro com **zero JavaScript desnecessário** para o cliente. A interatividade é isolada em ilhas React independentes:
  - `ContextIsland` e `FiltersIsland` (`client:load`): hidratados imediatamente para garantir controle imediato sobre presets analíticos, seletores de dimensão e o seletor `DateRangeFilter` (calendário popover com presets anuais e validação de datas).
  - `MetricsIsland` (`client:load`): reage instantaneamente aos filtros exibindo os 4 KPIs agregados.
  - `ChatIsland` (`client:load`): assistente conversacional inteligente (**SteamBot-9000**) com frases rotativas (teasers), gaveta responsiva e integração em tempo real com o recorte de filtros ativo via `POST /api/chat`.
  - `ChartsIsland` (`client:visible`): renderiza os gráficos Apache ECharts apenas quando entram no campo de visão (lazy hydration), com suporte a zoom temporal (`dataZoom`) e filtros reativos disparados por clique direto nos meses ou faixas de horas.
  - `ReviewsIsland` (`client:visible`): tabela virtualizada sob demanda para navegação e expansão detalhada das avaliações.
- **TanStack Query (React Query v5)**: Orquestra o ciclo de vida das requisições assíncronas aos endpoints da API (`/api/summary`, `/api/charts`, `/api/reviews`). Provê cache transparente em memória, deduplicação de buscas concorrentes, estados suaves de transição (`keepPreviousData` / `isPlaceholderData`) e gerenciamento de carregamento progressivo contínuo via `useInfiniteQuery` (janelas de 100 itens).
- **TanStack Table + TanStack Virtual**: Motor headless declarativo para tipagem, ordenação multicritério e formatação de colunas, combinado a um virtualizador de DOM (`useVirtualizer`) com medição dinâmica de altura. Apenas as linhas visíveis na janela de rolagem são renderizadas no DOM, viabilizando rolagem infinita estável a 60 FPS sobre centenas de avaliações carregadas.
- **Nanostores**: Barramento reativo atômico ultraleve que conecta os filtros da barra lateral, datas e presets analíticos a todas as ilhas React sem a necessidade de um Provider monolítico englobando toda a árvore HTML.
- **Feedback visual calibrado e anti-flicker**: Utilitário `useDelayedFlag` com retardo de 150 ms para evitar piscadas na interface em transições ultra-rápidas ou com dados em cache de memória.

### Endpoints da API

- `GET /api/summary` (e alias `/api/metrics`): Retorna volume total, taxa de recomendação, total de jogos e autores únicos para os filtros informados (suporta `app_id`, `language`, `recommended`, `steam_purchase`, `received_for_free`, `early_access`, `playtime_bucket`, `date_from` e `date_to`).
  > [!NOTE]
  > O endpoint `/api/summary` é o caminho oficial consumido pelo frontend para evitar interceptações locais de antivírus (ex.: Kaspersky interceptando requisições a rotas denominadas `/api/metrics`).
- `GET /api/charts`: Devolve simultaneamente a distribuição mensal (`timeline`), a taxa de aprovação por faixa de horas jogadas (`playtime_buckets`), o top 10 de jogos por volume (`game_rankings`) e os idiomas mais frequentes ordenados por aprovação (`language_rankings`). Ao filtrar um único mês (`date_from` e `date_to` no mesmo mês), a série mensal preserva a curva completa para destacar o mês selecionado no gráfico sem colapsar a 1 ponto, enquanto os demais painéis são filtrados pelo mês.
- `GET /api/facets`: Contagens por jogo (`games`) e por idioma (`languages`) no recorte atual, usadas pelos seletores da barra lateral e pelos rankings.
- `GET /api/reviews`: Retorna a lista paginada de avaliações com suporte a todos os filtros dimensionais e temporais, ordenação por data (`created_at`), horas de jogo (`playtime_hours`) ou votos úteis (`votes_helpful`), além de paginação via `limit` (até 100) e `offset`.
- `POST /api/chat`: Endpoint conversacional inteligente alimentado pelo agente LangChain (`SteamBot-9000`). Recebe a mensagem do usuário, histórico e o recorte atual de filtros. O robô aciona dinamicamente as ferramentas analíticas do backend (`get_metrics`, `get_charts`, `get_reviews_sample`) e devolve a resposta formatada em Markdown com tabelas GFM, metadados de execução, suporte a cancelamento de stream/geração via `AbortSignal` e lista de ferramentas utilizadas (`tools_used`).
- `GET /health`: Health check simples para monitoramento do serviço.
- `GET /docs`: Documentação interativa Swagger/OpenAPI gerada automaticamente pelo FastAPI.

---

## 3. Metodologia do Experimento e Agentes

A análise exploratória original foi construída com um protocolo de orquestração por IA documentado em `AGENTS.md`:

O modelo da conversa principal é o **Gemini 4 Argon** (modelo de fronteira para raciocínio complexo e auditoria de código). Ele atua no planejamento, formulação dos critérios de pronto e conferência nos arquivos. Os subagentes `explorer` e `executor` usam o **Gemini 3.8 Flash** para tarefas de varredura e codificação/verificação com contexto limpo.

```mermaid
flowchart TD
    A["Analista de Dados (Humano): Direção de Negócio e Escopo"] --> B["Orquestrador (Gemini 4 Argon): Planeja e Cria Prompts de Delegação"]
    B -->|"1. Instancia com Prompt Próprio e Contexto Limpo"| C["Subagente explorer (Gemini 3.8 Flash): Mapeia CSVs e Esquemas"]
    B -->|"1. Instancia com Prompt Próprio e Contexto Limpo"| D["Subagente executor (Gemini 3.8 Flash): Codifica Notebook e Roda Sanity Check"]
    C -->|"2. Retorna Caminhos, Linhas e Resumo"| E["Revisão pelo Argon: Audita Resultado nos Arquivos"]
    D -->|"2. Retorna Arquivos Alterados e Log de Verificação"| E
    E -->|"Divergência Detectada: Novo Ciclo de Ajuste"| B
    E -->|"3. Aprovado com 100% de Consistência"| F["Artefatos Finais Validados (analysis.ipynb, Dashboard e README.md)"]
```

Sem um dicionário de dados prévio nos prompts, o Argon e o Flash identificaram:
1. A partição vertical 1:1 estrita por `review_id` entre as quatro tabelas;
2. O underflow de `uint32` no contador `votes_funny`;
3. Reviews anômalas de copypasta com milhões de caracteres;
4. A descontinuidade estatística na taxa de aprovação causada pela regra de reembolso de 2 horas da Valve.

---

## 4. Estrutura do Repositório

```text
game-review-dashboard/
├── assets/                               # Demonstrações visuais (GIF, MP4 e pôster)
│   ├── overview.gif                      # Animação inline para o README
│   ├── overview.mp4                      # Vídeo resumo em alta definição
│   ├── showcase.mp4                      # Vídeo showcase completo do dashboard
│   └── showcase-poster.png               # Pôster estático de apresentação
├── backend/                              # API FastAPI e camada de dados
│   ├── app/
│   │   ├── baseline.json                 # Agregados pré-calculados da base completa (resposta sem filtros)
│   │   ├── chat.py                       # Agente SteamBot-9000 (LangChain + OpenRouter) e ferramentas
│   │   ├── database.py                   # Engine SQLAlchemy: SQLite local ou PostgreSQL via DATABASE_URL
│   │   ├── main.py                       # Rotas da API, CORS e cabeçalhos Cache-Control
│   │   ├── models.py                     # Modelo relacional ORM da tabela reviews
│   │   ├── queries.py                    # Agregações SQL, filtragem paramétrica e cache LRU
│   │   ├── schemas.py                    # Schemas de validação Pydantic
│   │   ├── seed.py                       # Pipeline de ingestão e higienização dos CSVs
│   │   └── transform.py                  # Regras de limpeza, underflow e buckets
│   ├── data/
│   │   └── reviews.db                    # Banco SQLite higienizado (gerado pelo seed, fora do git)
│   └── tests/
│       └── test_api.py                   # Testes automatizados da API (Pytest + TestClient)
├── data/                                 # Partições originais do Kaggle (fora do git)
│   ├── review_info.csv                   # Texto, votos e recomendação (~364 MB)
│   ├── game_info.csv                     # Dados dos jogos (app_id e app_name) (~28 MB)
│   ├── author_info.csv                   # Telemetria e perfil do autor (~58 MB)
│   └── purchase_info.csv                 # Tipo de compra e early access (~10 MB)
├── frontend/                             # Aplicação web interativa (Astro + React Islands)
│   ├── public/                           # Favicon e ícones estáticos
│   ├── src/
│   │   ├── components/                   # Componentes Astro estáticos (ChartCard, FilterCombo, MetricCard,
│   │   │   │                             #   TriFilter, ComboToggle, ContextBar, MobileBar, Sidebar, ThemeToggle…)
│   │   │   └── react/                    # Ilhas interativas React
│   │   │       ├── BotGlyph.tsx          # Glifo animado do SteamBot-9000
│   │   │       ├── ChartsIsland.tsx      # Gráficos ECharts (client:visible) com zoom e filtros por clique
│   │   │       ├── ChatIsland.tsx        # Assistente SteamBot-9000 (client:load)
│   │   │       ├── ContextIsland.tsx     # Presets analíticos e chips dinâmicos de filtro (client:load)
│   │   │       ├── DateRangeFilter.tsx   # Seletor de período com presets anuais e calendário interativo
│   │   │       ├── EmptyState.tsx        # Estado vazio para recortes sem resultado
│   │   │       ├── FiltersIsland.tsx     # Controles laterais, combos com busca e seletores (client:load)
│   │   │       ├── MetricsIsland.tsx     # 4 cards de KPIs agregados (client:load)
│   │   │       ├── QueryRoot.tsx         # Provedor compartilhado do TanStack Query
│   │   │       ├── RailIcon.tsx          # Ícones Lucide padronizados
│   │   │       └── ReviewsIsland.tsx     # Tabela virtualizada com TanStack Table + Virtual (client:visible)
│   │   ├── layouts/Base.astro            # Layout base HTML com meta tags e fontes IBM Plex
│   │   ├── lib/                          # api.ts (cliente tipado), constants.ts, format.ts, queryClient.ts,
│   │   │                                 #   fetchFeedback.ts (useDelayedFlag), useNanostore.ts, useHydrated.ts,
│   │   │                                 #   useGridReflowMotion.ts
│   │   ├── pages/index.astro             # Ponto de entrada do dashboard
│   │   ├── scripts/                      # charts.ts, combo.ts, dashboard.ts, renderers.ts, theme.ts
│   │   ├── stores/                       # filters.ts, metrics.ts, urlSync.ts (Nanostores + URL)
│   │   └── styles/                       # global.css (tokens Tailwind v4) + CSS por área
│   │                                     #   (charts, chat, findings, metrics, reviews, sidebar)
│   ├── astro.config.mjs                  # Astro com React, Tailwind e proxy /api → :8000
│   └── package.json                      # Dependências do frontend
├── scripts/
│   ├── migrate_sqlite_to_pg.py           # Migração do SQLite local para PostgreSQL / Supabase
│   ├── export_analytics_parquet.py       # Snapshot Parquet que a API carrega no DuckDB
│   ├── start-jupyter.ps1                 # Inicialização do JupyterLab no Windows PowerShell
│   └── start-jupyter.sh                  # Inicialização do JupyterLab no Linux / macOS
├── video/                                # Pipeline de captura determinística e renderização Remotion
│   ├── capture/                          # Captura headless via Playwright + CDP a 60 FPS
│   │   ├── engine.ts                     # Engine de gravação, interpolação de cursor e time-dilation
│   │   ├── record.ts                     # Roteiro das tomadas desktop e mobile (saída em video/captures/)
│   │   └── review.ts                     # Utilitário de inspeção e validação de frames
│   ├── public/                           # Tomadas desktop/mobile usadas na renderização e trilhas sonoras
│   ├── src/                              # Composições Remotion (Showcase e Overview a 60 FPS)
│   └── package.json                      # Scripts de captura/renderização e dependências
├── analysis.ipynb                        # Notebook analítico exploratório original
├── AGENTS.md                             # Protocolo operacional da equipe de agentes de IA
├── DESIGN.md                             # Design system do dashboard (tokens, superfícies tonais, motion)
├── PRODUCT.md                            # Especificação de produto e direcionamento de UX
├── iniciar-servidores.bat                # Atalho Windows: sobe backend (:8000) e frontend (:4321)
├── pyproject.toml / uv.lock              # Dependências Python gerenciadas via uv
├── requirements.txt                      # Dependências mínimas do backend para o deploy (Render)
├── pytest.ini                            # Configuração da suíte de testes
└── README.md                             # Documentação técnica do projeto
```

---

## 5. Modelagem Relacional e Saneamento de Dados

### Arquitetura Relacional 1:1

As quatro tabelas CSV compõem uma **partição vertical 1:1 indexada por `review_id`**. Cada tabela tem exatamente 1.000.000 de linhas, com as mesmas chaves e alinhamento ordenado idêntico:

```mermaid
erDiagram
    REVIEW_INFO ||--|| GAME_INFO : "1:1 (review_id)"
    REVIEW_INFO ||--|| AUTHOR_INFO : "1:1 (review_id)"
    REVIEW_INFO ||--|| PURCHASE_INFO : "1:1 (review_id)"

    REVIEW_INFO {
        bigint review_id PK "Chave primária da avaliação"
        string language "Idioma registrado"
        string review "Texto da avaliação"
        bigint timestamp_created "Timestamp Unix de publicação"
        bigint timestamp_updated "Timestamp Unix da última edição"
        boolean recommended "Recomendação (True = Positiva)"
        bigint votes_helpful "Votos de utilidade"
        bigint votes_funny "Votos de engraçado (uint32)"
        float weighted_vote_score "Escore algorítmico da Steam"
        bigint comment_count "Número de comentários"
    }

    GAME_INFO {
        bigint review_id PK,FK "Referência 1:1"
        bigint app_id "Identificador do jogo na Steam"
        string app_name "Nome do jogo"
    }

    AUTHOR_INFO {
        bigint review_id PK,FK "Referência 1:1"
        bigint author_steamid "ID da conta do autor"
        bigint author_num_games_owned "Jogos na biblioteca"
        bigint author_num_reviews "Avaliações públicas do autor"
        float author_playtime_forever "Tempo total jogado (minutos)"
        float author_playtime_last_two_weeks "Tempo nas últimas 2 semanas (minutos)"
        float author_playtime_at_review "Tempo até a publicação (minutos)"
        float author_last_played "Timestamp da última sessão"
    }

    PURCHASE_INFO {
        bigint review_id PK,FK "Referência 1:1"
        boolean steam_purchase "Comprado na loja Steam"
        boolean received_for_free "Recebido gratuitamente"
        boolean written_during_early_access "Escrito em Acesso Antecipado"
    }
```

### Regras de Limpeza e Higienização

1. **Underflow de `uint32` em `votes_funny`**: Registrado na origem como inteiro de 32 bits sem sinal. Quando a contagem sofria decremento na API da Valve (-1, -2, etc.), o valor sofria wrap-around para valores próximos de $2^{32} - 1 = 4.294.967.295$. A higienização converte qualquer valor $\ge 4.294.967.292$ para `0`. O valor máximo real observado após a correção é de **8.983 votos**.
2. **Textos em copypasta extrema**: Duas avaliações apresentam repetição em massa acima do limite padrão da interface: uma com **9.639.004 caracteres** (*Arma 3*) e outra com **4.971.225 caracteres** (*For Honor*). No banco e no dashboard, os resumos textuais são truncados com segurança (`excerpt` de até 280 caracteres).
3. **Tratamento de nulos e vazios**: `review` possuía 1.294 valores nulos e 174 avaliações compostas apenas de espaços em branco (preenchidos com string vazia). `author.playtime_at_review` continha 1.248 nulos (mantidos como nulos na base e tratados nas agregações).
4. **Telemetria de horas jogadas**: Em 116 registros (0,01%), o tempo registrado no momento da review superava o tempo total jogado na conta; nesses casos o cálculo de tempo jogado pós-avaliação adota $\max(0, \text{playtime\_forever} - \text{playtime\_at\_review})$.

---

## 6. Principais Descobertas de Negócio

### Concentração do Catálogo

Cinco jogos concentram **54,65% das avaliações** (546.549 de 1.000.000): *Arma 3*, *The Elder Scrolls V: Skyrim Special Edition*, *For Honor*, *Darkest Dungeon* e *NieR:Automata*.
- **Maior aprovação**: *STEINS;GATE 0* (96,5%), *The Legend of Heroes: Trails of Cold Steel II* (95,2%) e *Farm Together* (93,8%).
- **Menor aprovação**: *SOS* (27,8%), *DYNASTY WARRIORS 9* (31,2%) e *Bless Online* (38,0%).

### Avaliações Negativas: "A Economia da Insatisfação"

Embora a base seja majoritariamente favorável (taxa global de **82,97%** de recomendação), os usuários descontentes geram engajamento substancialmente mais intenso:

| Métrica | Avaliação Positiva | Avaliação Negativa | Diferença / Impacto |
| :--- | :---: | :---: | :--- |
| **Proporção na base** | 82,97% | 17,03% | ~4,9 para 1 |
| **Probabilidade de receber voto útil (> 0)** | 31,6% | 63,3% | **2,0x mais provável** |
| **Média de votos úteis recebidos** | 2,56 votos | 7,08 votos | **2,8x mais votos úteis** |
| **Mediana do tamanho do texto** | 57 caracteres | 112 caracteres | **~2,0x mais longo** |
| **Média de comentários recebidos** | 0,13 comentários | 0,55 comentários | **4,25x mais comentários** |
| **Mediana de tempo jogado pós-review** | 13,98 horas | 1,18 horas | **Abandono do jogo** |

O texto de uma avaliação negativa geralmente detalha bugs técnicos, quebras de balanceamento ou decisões impopulares de monetização, servindo como sinal de alerta para a comunidade.

### A Janela de Reembolso de 2 Horas da Valve

A política de reembolso da Steam permite devolução do dinheiro para jogos com menos de 2 horas jogadas. Os dados revelam uma inflexão acentuada na taxa de aprovação exatamente nessa fronteira:

```mermaid
xychart-beta
    title "Taxa de Recomendacao (%) vs Tempo de Jogo na Avaliacao"
    x-axis ["<1h", "1-2h", "2-5h", "5-10h", "10-25h", "25-50h", "50-100h", "100-500h", "500h+"]
    y-axis "Taxa de Recomendacao (%)" 40 --> 100
    bar [49.6, 59.9, 77.4, 81.4, 84.9, 88.2, 89.5, 89.9, 93.3]
```

- **Abaixo de 1 hora**: aprovação de apenas **49,6%** (maior média de votos úteis da base: 4,77).
- **Entre 1 e 2 horas**: aprovação sobe para **59,9%**.
- **Acima de 2 horas (sem direito a reembolso imediato)**: a taxa salta para **77,4%** (2 a 5 horas) e atinge **93,3%** para jogadores veteranos com mais de 500 horas.

### Modalidade de Compra, Acesso Antecipado e Edição

- **Acesso Antecipado**: aprovação de **69,8%** durante o desenvolvimento antecipado vs. **83,8%** na versão estável (diferença de **14,0 pontos percentuais**).
- **Reviews Editadas**: 13,11% da base foi editada. Têm aprovação de **74,3%** (vs. 84,3% das não editadas), texto 4x mais longo (770 caracteres) e recebem **3,3x mais votos úteis** (8,43 vs. 2,56).
- **Origem da Aquisição**: compra direta na loja Steam tem 83,8% de aprovação, contra 81,2% em chaves externas e 78,7% em cópias recebidas gratuitamente.

---

## 7. Como Executar o Projeto

### Pré-requisitos

- [Python](https://www.python.org/) >= 3.14
- [uv](https://docs.astral.sh/uv/) (gerenciador rápido de pacotes Python)
- [Node.js](https://nodejs.org/) >= 22.23 e `npm` (exigência do Astro 7)

---

### Passo 1: Clonar o Repositório e Sincronizar o Ambiente Python

```bash
git clone https://github.com/EmersonPalatti/game-review-dashboard.git
cd game-review-dashboard
uv sync
```

---

### Passo 2: Obter os Dados

1. Baixe o [Game Reviews Dataset no Kaggle](https://www.kaggle.com/datasets/sridharstreaks/game-reviews-dataset).
2. Extraia os 4 arquivos CSV para a pasta `data/` na raiz do projeto:
   - `data/review_info.csv`
   - `data/game_info.csv`
   - `data/author_info.csv`
   - `data/purchase_info.csv`

---

### Passo 3: Ingerir e Higienizar os Dados no SQLite

Execute o script de seed para criar o banco `backend/data/reviews.db` com todas as validações aplicadas:

```bash
# Ingestão completa de 1 milhão de registros (~1 a 2 minutos):
uv run python -m backend.app.seed

# Ou para um teste rápido com amostragem reduzida:
uv run python -m backend.app.seed --limit 50000
```

---

### Passo 4: Executar o Backend (FastAPI)

#### Configuração do Assistente SteamBot-9000 (Opcional, mas Recomendado)
Para interagir com o assistente inteligente gamer (**SteamBot-9000**) via endpoint `POST /api/chat` com chamadas automáticas de ferramentas (*tool-calling*), obtenha uma chave de API gratuita no [OpenRouter](https://openrouter.ai/) e configure a variável de ambiente:

**No Windows PowerShell:**
```powershell
$env:OPENROUTER_API_KEY = "sk-or-v1-..."
# Opcional: especificar outro modelo (padrão gratuito: nvidia/nemotron-3-ultra-550b-a55b:free)
# $env:OPENROUTER_MODEL = "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
```

**No Linux ou macOS (Bash):**
```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
# export OPENROUTER_MODEL="openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
```

**Ou via arquivo `.env` na raiz do repositório:**
```dotenv
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=openrouter/nvidia/nemotron-3-ultra-550b-a55b:free
```

> [!NOTE]
> Se `OPENROUTER_API_KEY` não for configurada, o painel e os endpoints analíticos (`/api/summary`, `/api/charts`, `/api/reviews`) continuam funcionando normalmente. Apenas o chat retornará uma instrução amigável indicando a necessidade da chave para acionar o modelo de linguagem.

#### Outras variáveis de ambiente (deploy)

| Variável | Onde | Uso |
| :--- | :--- | :--- |
| `DATABASE_URL` | Backend | String de conexão PostgreSQL (Supabase). Sem ela, o backend usa `backend/data/reviews.db`. Aceita `postgres://` e `postgresql://`. |
| `CORS_ORIGINS` | Backend | Origens permitidas, separadas por vírgula. Sem ela, libera `*`. |
| `PUBLIC_API_URL` | Frontend (build) | URL base da API publicada (ex.: o serviço no Render). Sem ela, o frontend chama `/api` no mesmo host, que o proxy do Astro encaminha para a porta 8000 em desenvolvimento. |

Para levar o banco local para o PostgreSQL de produção:

```bash
uv run python scripts/migrate_sqlite_to_pg.py --target-url postgresql://user:pass@host:5432/postgres
# ou defina TARGET_DATABASE_URL / DATABASE_URL no ambiente
```

As agregações rodam num DuckDB em memória carregado de `backend/app/reviews.parquet` (cerca de 12 MB, versionado). O Postgres serve só o texto das avaliações, buscado por chave primária. Sempre que o acervo mudar, gere o snapshot de novo:

```bash
uv run python scripts/export_analytics_parquet.py                       # a partir do SQLite local
uv run python scripts/export_analytics_parquet.py --source-url postgresql://user:pass@host:5432/postgres
```

Variáveis opcionais: `ANALYTICS_PARQUET` (caminho do snapshot), `ANALYTICS_THREADS` (padrão `1`) e `ANALYTICS_MEMORY_LIMIT` (padrão `200MB`).

#### Iniciar o Servidor FastAPI
Inicie o servidor da API com hot-reload:

```bash
uv run uvicorn backend.app.main:app --reload --port 8000
```

- API disponível em: `http://127.0.0.1:8000`
- Documentação interativa Swagger: `http://127.0.0.1:8000/docs`

No Windows, `iniciar-servidores.bat` abre backend e frontend em duas janelas (usa a `.venv` do projeto e assume o repositório em `C:\Projects\game-review-dashboard`).

Para rodar a suíte de testes automatizados do backend:

```bash
uv run pytest
```

---

### Passo 5: Executar o Frontend (Astro)

Em outro terminal, instale as dependências e suba a interface web:

```bash
cd frontend
npm install
npm run dev
```

- Painel interativo disponível em: `http://localhost:4321` (com proxy automático encaminhando `/api/*` para o backend na porta 8000).

Para gerar o build estático de produção do frontend:

```bash
npm run build
```

---

### Passo 6 (Opcional): Executar o Notebook JupyterLab

Caso queira inspecionar a análise exploratória passo a passo em notebook:

**No Windows (PowerShell):**
```powershell
.\scripts\start-jupyter.ps1
```

**No Linux ou macOS (Bash):**
```bash
chmod +x ./scripts/start-jupyter.sh
./scripts/start-jupyter.sh
```

Acesse em `http://127.0.0.1:8888/?token=agentic`.

Para reexecutar o notebook via linha de comando:
```bash
uv run jupyter nbconvert --to notebook --execute analysis.ipynb --inplace
```

---

### Passo 7 (Opcional): Pipeline de Vídeo com Remotion e Playwright (`video/`)

Para capturar e renderizar as animações e o showcase a 60 FPS:

```bash
cd video
npm install

# 1. Gravar as tomadas determinísticas (com backend na porta 8000 e frontend na porta 4321):
npm run capture

# 2. Renderizar o vídeo showcase em 1080p a 60 FPS:
npm run render:showcase

# 3. Renderizar a animação de visão geral (overview):
npm run render:overview
```

---

## 8. Stack Tecnológica

### Frontend
- **[Astro 7](https://astro.build/)**: framework web com arquitetura de ilhas (Islands Architecture) e zero JavaScript enviado para a casca estática da aplicação.
- **[React 19 & React Islands](https://react.dev/) (`@astrojs/react`)**: ilhas interativas de componentes hidratadas sob demanda (`client:load` para filtros, presets, KPIs e o chat do **SteamBot-9000**; `client:visible` para gráficos ECharts e tabela de reviews).
- **[TanStack Query v5](https://tanstack.com/query/latest)**: gerenciamento de estado assíncrono, cache inteligente em memória, deduplicação de requisições, refetch reativo e paginação infinita (`useInfiniteQuery`).
- **[TanStack Table v9](https://tanstack.com/table/latest)**: motor headless para gerenciamento tabular, ordenação dinâmica multicritério e mapeamento de colunas fortemente tipado.
- **[TanStack Virtual v3](https://tanstack.com/virtual/latest)**: virtualização de lista (`useVirtualizer`) com medição dinâmica de altura de linhas, garantindo rolagem suave a 60 FPS e consumo mínimo de memória no DOM.
- **[Apache ECharts 6](https://echarts.apache.org/)**: gráficos interativos de alta performance para séries temporais e taxas de aprovação por tempo de jogo.
- **[Nanostores](https://github.com/nanostores/nanostores)**: barramento de estado reativo, desacoplado e ultraleve para sincronização bidirecional entre o **SteamBot-9000** e todas as ilhas React sem Providers globais.
- **[Tailwind CSS v4](https://tailwindcss.com/)**: estilização moderna com suporte nativo a CSS moderno, design tokens e transições de tema claro/escuro.
- **Micro-Animações & Motion Craft (`transitions-dev`)**: biblioteca de micro-física e coreografia cinética em CSS puro (Matrix Dot Loader 4×4, Staggered Block Reveal, Accordion via CSS Grid, SVG Stroke-Draw Checkmark, Drawer Slide-Down e Composer Shake).
- **[TypeScript](https://www.typescriptlang.org/)**: tipagem estática ponta a ponta alinhada aos modelos Pydantic do backend.
- **[Lucide Icons](https://lucide.dev/)**: pacote consistente de ícones vetoriais.

### Backend & Inteligência Artificial
- **[Python 3.14](https://www.python.org/)**
- **[FastAPI](https://fastapi.tiangolo.com/)**: criação de APIs assíncronas de alta performance com validação automática via **Pydantic**.
- **[LangChain & OpenRouter](https://openrouter.ai/)**: orquestração do agente autônomo **SteamBot-9000** com *tool-calling* em tempo real (`get_metrics`, `get_charts`, `get_reviews_sample`) e suporte a modelos de linguagem de ponta (`nvidia/nemotron-3-ultra-550b-a55b:free`).
- **[SQLAlchemy 2](https://www.sqlalchemy.org/)**: modelagem ORM e construção de consultas SQL agregadas com suporte híbrido SQLite/PostgreSQL.
- **[PostgreSQL / Supabase](https://supabase.com/)**: banco de dados em produção na nuvem com índices otimizados para 1.000.000 de avaliações.
- **[SQLite](https://www.sqlite.org/)**: armazenamento local transacional e consultas indexadas para prototipação e testes.
- **[uv](https://docs.astral.sh/uv/)**: gerenciamento moderno de dependências e ambientes virtuais.
- **[Pytest](https://pytest.org/)**: testes de integração automatizados da API (45 testes cobrindo agregação, filtros, paginação e chat).

### Infraestrutura & Deploy em Produção
- **[Vercel](https://vercel.com/)**: hospedagem do frontend Astro estático com distribuição global via CDN Edge de baixa latência.
- **[Render](https://render.com/)**: hospedagem do backend FastAPI em Web Service Python com cache LRU em memória e cabeçalhos HTTP `Cache-Control`.
- **[Supabase](https://supabase.com/)**: instância gerenciada de PostgreSQL na nuvem com pooling de conexões e índices B-Tree dedicados.

### Análise Exploratória & Machine Learning
- **[Pandas](https://pandas.pydata.org/) & [NumPy](https://numpy.org/)**: manipulação vetorial e cálculos estatísticos.
- **[Matplotlib](https://matplotlib.org/) & [Seaborn](https://seaborn.pydata.org/)**: geração de gráficos estáticos no notebook.
- **[JupyterLab](https://jupyter.org/) & `ipykernel`**: ambiente interativo de ciência de dados.

### Vídeo Programático & Motion Graphics
- **[Remotion](https://www.remotion.dev/)**: composição, motion design e renderização em React/TypeScript a 60 FPS com decodificação `OffthreadVideo`.
- **[Playwright](https://playwright.dev/)**: captura determinística via screencast do Chrome DevTools Protocol (CDP) com clock virtual sincronizado.
- **[FFmpeg](https://ffmpeg.org/)**: muxing de áudio, normalização e codificação H.264/NVENC.

### Orquestração de IA
- **Gemini 4 Argon** (conversa principal, planejamento analítico e auditoria).
- **Gemini 3.8 Flash** (`explorer` e `executor` para varredura e codificação).
- Protocolo operacional especificado em `AGENTS.md`.

---

## 9. Autor

Desenvolvido por **[Emerson Palatti](https://github.com/EmersonPalatti)**.
