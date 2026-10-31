---
target: frontend/src/pages/index.astro
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:a0de305908840acf0ec710a696badd633c7a11cce52a99c68843c4a07d7baab3"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-10-31T18-02-18Z
slug: frontend-src-pages-index-astro
closed: true
---
Method: dual-agent (A: 76257d88-1fbb-4525-a141-47c2565edf26 · B: 628efb24-7dc0-4e93-ae8b-0b90cbc47d19)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Com o trilho recolhido (`60px`), filtros ativos e resumo somem (`opacity: 0`); gráficos e tabela não indicam `aria-busy`. |
| 2 | Match System / Real World | 3 | Boa localização `pt-BR` (29 idiomas, `tabular-nums`), mas faltam referências do domínio Steam (janela de 2h, tags de aquisição/Acesso Antecipado). |
| 3 | User Control and Freedom | 2 | Sem chips para remover filtro individual, sem sincronização com `URLSearchParams` (botão Voltar/link quebram) e paginação apenas linear. |
| 4 | Consistency and Standards | 3 | Tokens e tipografia coesos, mas filtros booleanos de 3 opções (`Todas`/`Sim`/`Não`) usam `<input type="text" role="combobox">`. |
| 5 | Error Prevention | 3 | `renderCatalog` restringe opções válidas e `finishEditing` reverte entradas inválidas, mas comboboxes omitem `review_count` prévio. |
| 6 | Recognition Rather Than Recall | 1 | Trilho lateral recolhe ao mover o mouse para o palco, exigindo memorizar os 7 filtros ativos; topo mobile omite o nome do produto. |
| 7 | Flexibility and Efficiency | 2 | Busca sem acento nos combos, porém gráficos e rankings não permitem clique para cross-filtering e filtros simples exigem abrir dropdown. |
| 8 | Aesthetic and Minimalist Design | 4 | Paleta editorial enxuta (`--paper`/`--ink`/`--accent`), escala tipográfica rigorosa e zero ruído decorativo. |
| 9 | Error Recovery | 2 | `#load-error` exibe mensagem genérica (`"Não foi possível carregar os dados."`) sem expor causa/status (ex.: backend offline ou HTTP 499). |
| 10 | Help and Documentation | 2 | Subtítulos concisos nos cartões, mas sem contexto visível sobre o recorte temporal quando a sidebar recolhe ou sobre campos saneados (`—`). |
| **Total** | | **24/40** | **Acceptable (60% — base visual sólida, mas com lacunas importantes de ergonomia analítica e visibilidade de estado)** |

#### Design Specificity Verdict

**LLM assessment**: O sistema visual editorial em papel e tinta (`--paper: #f4f4f2`, `--ink: #1c1915`, `--accent: #1f4e46`, `--negative: #9d341f` com `IBM Plex Sans` e `IBM Plex Mono`) foge com maturidade dos clichês "gamer neon" e honra o tom técnico de `PRODUCT.md`. Contudo, a estrutura e o modelo de interação ainda são **intercambiáveis de categoria**: se trocarmos os rótulos por "Tickets de Suporte" ou "Pedidos de E-commerce", 95% da página permaneceria idêntica. As teses empíricas mais fortes do estudo — a **janela de reembolso de 2 horas da Valve** (`49,6%` em `<1h` e `59,9%` em `1–2h` saltando para `77,4%` em `2–5h`), a **"Economia da Insatisfação"** nas reviews negativas (`2,8x` mais votos úteis), o saneamento de underflow `uint32` em `votes_funny` e a queda de `14,0 p.p.` no **Acesso Antecipado** — estão ausentes da superfície visual e dos metadados exibidos na tabela.

**Deterministic scan**:
- Varredura estática (`impeccable detect --json frontend/src/pages/index.astro` e `frontend/src`): **0 problemas** (`exit code 0`).
- Varredura em DOM vivo (`impeccable detect --json http://localhost:4321` em `1280x800` e `390x844`): **1 alerta (`cramped-padding` em `div.sheet` no desktop)** e **0 alertas no mobile**.
- **Análise de falso positivo**: O alerta `cramped-padding` em `div.sheet` (`frontend/src/pages/index.astro:375`, `frontend/src/styles/global.css:694-736`) é um **falso positivo** do detector — `div.sheet` usa `padding: 0` intencionalmente para que as bordas de linha (`border-bottom: 1px solid var(--line)`) e o hover da tabela toquem as bordas do cartão, enquanto `.sheet th, .sheet td` já aplicam `padding: 12px 16px`. O detector mede o `Range` do texto longo na última coluna (`Trecho`) antes do recorte de `overflow: hidden; text-overflow: ellipsis`. Ainda assim, o achado aponta para um sintoma real diagnosticado pelo Assessment A: a coluna `Trecho` está espremida em apenas `22%` da largura da tabela.

**Visual overlays**: Nenhuma sobreposição visual interativa foi injetada em aba visível ao usuário (`no browser automation tool exposed in harness; live overlay injection skipped`), mas a página ativa em `http://localhost:4321` foi inspecionada via `impeccable detect` headless em viewports desktop e mobile.

#### Overall Impression

A fundação estética e de código é de alto nível: tipografia tabular impecável, paleta quente equilibrada e uma transição de tema claro/escuro com View Transitions API digna de vitrine. O que segura o painel hoje não é falta de polimento CSS, e sim **fricção operacional e timidez analítica**: a barra lateral recolhível esconde quais filtros estão ativos assim que o mouse sai dela, gráficos e rankings não respondem ao clique para filtragem cruzada, e a tabela espreme o texto real das avaliações em `22%` da largura enquanto descarta metade dos metadados que a API já entrega.

#### What's Working

1. **Transição de tema com View Transitions API e preservação de geometria (`dashboard.ts:737-840`, `global.css:334-351`)**: O cálculo da hipotenusa em `circleClip()` em coordenadas percentuais evita distorções de DPI fracionário, e `freezeRail()` + `.is-theme-hold` impedem que o trilho lateral colapse durante o snapshot da animação, respeitando `prefers-reduced-motion: reduce`.
2. **Rigor tipográfico e numérico (`global.css:21-24`, `global.css:386-395`, `dashboard.ts:548-567`)**: Escala contida em 5 degraus, `IBM Plex Mono` com `tabular-nums` em todos os KPIs, rankings, colunas numéricas e paginação, além de interpolação suave (`paintFigure`, `360ms`) sem deslocamento horizontal de layout.
3. **Controle de concorrência e sincronização cromática nos gráficos (`dashboard.ts:847-874`, `charts.ts:13-27`)**: O token monotônico `++requestId` descarta respostas fora de ordem em trocas rápidas de filtro, e `palette()` lê os CSS Custom Properties diretamente do DOM para repintar o ECharts instantaneamente ao alternar entre claro e escuro.

#### Priority Issues

- **[P1] What**: **Filtros ativos e identidade do produto desaparecem quando o trilho lateral recolhe, e o estado não sincroniza com a URL** (`frontend/src/styles/global.css:284-332`, `frontend/src/stores/filters.ts:27-44`, `frontend/src/pages/index.astro:9-40`).
  - **Why it matters**: No desktop (`>= 768px`), assim que o cursor sai da barra lateral para explorar os gráficos, `.sidebar-panel` encolhe para `60px` e oculta `.sidebar-reveal` (`<h1>Reviews da Steam</h1>`, rótulos e valores selecionados) e `#filter-summary`. Os 9 ícones restantes não mudam de estilo quando há filtro ativo. No mobile (`< 768px`), `.sidebar-mobile-bar` mostra apenas um botão hambúrguer sem o título do projeto. Além disso, o recorte não vai para `window.location.search`, quebrando o compartilhamento de links por avaliadores técnicos.
  - **Fix**: Exibir uma barra de contexto persistente no topo de `#dashboard-main` (ou manter o estado visível com chips removíveis para cada filtro ativo + botão `Limpar filtros`), sinalizar visualmente ícones com filtro ativo na rail de `60px`, exibir o título na barra mobile e sincronizar `filters` e `page` com `URLSearchParams` (`history.replaceState`).
  - **Suggested command**: `/impeccable clarify`

- **[P1] What**: **Gráficos e rankings são passivos (sem clique para cross-filtering) e `chart-playtime` não evidencia a janela de reembolso de 2 horas nem a linha de base** (`frontend/src/scripts/charts.ts:190-255`, `frontend/src/scripts/dashboard.ts:606-648`).
  - **Why it matters**: O coração do estudo em `PRODUCT.md` é a filtragem cruzada e a descoberta do salto de aprovação após a janela de reembolso de 2h da Valve (`49,6%` em `<1h` e `59,9%` em `1–2h` → `77,4%` em `2–5h`, frente à média global de `82,97%`). Hoje todas as 9 barras têm a mesma cor (`colors.ink`), sem linha de referência (`markLine`) e com `cursor: 'default'`. Clicar em um jogo em `#rank-games`, idioma em `#rank-languages` ou faixa em `chart-playtime` não filtra o painel.
  - **Fix**: Adicionar marcação visual/anotação da fronteira de `2h` (reembolso Steam) e linha de referência de recomendação em `chart-playtime`, diferenciar a barra ativa e conectar eventos de clique em `chart-playtime`, `#rank-games` e `#rank-languages` a `patchFilters()` para cross-filtering bidirecional em 1 clique.
  - **Suggested command**: `/impeccable delight`

- **[P2] What**: **Tabela de avaliações reserva apenas 22% da largura para a coluna `Trecho` em linha única truncada e descarta metadados valiosos da API** (`frontend/src/pages/index.astro:375-390`, `frontend/src/styles/global.css:727-736`, `frontend/src/scripts/dashboard.ts:681-705`).
  - **Why it matters**: As 5 primeiras colunas consomem `78%` da largura (`22% + 16% + 14% + 14% + 12%`), espremendo o texto da avaliação em ~30 caracteres com `white-space: nowrap; text-overflow: ellipsis` e exigindo hover com mouse (`title`) para leitura — o que falha em teclado e touch. Ao mesmo tempo, `created_at`, `votes_funny` (saneado de underflow `uint32`), `comment_count`, `early_access`, `steam_purchase` e `received_for_free`, já presentes no payload de `/api/reviews`, são ignorados.
  - **Fix**: Rebalancear as larguras das colunas para dedicar `42%–48%` ao `Trecho`, permitir leitura em múltiplas linhas (`line-clamp-2`) ou expansão da linha via clique/teclado (`Enter`/`Space`), e exibir os metadados de contexto (selo *Acesso Antecipado*, *Gratuito*, data `created_at` e `votes_funny`).
  - **Suggested command**: `/impeccable layout`

- **[P2] What**: **Filtros tri-estado usam `<input type="text" role="combobox">` e comboboxes de catálogo omitem a contagem de avaliações por opção** (`frontend/src/pages/index.astro:139-262`, `frontend/src/scripts/dashboard.ts:411-423`, `frontend/src/scripts/dashboard.ts:526-546`).
  - **Why it matters**: Usar caixa de busca textual para campos de 3 opções fixas (`Todas` / `Sim` / `Não`) em `Recomendação`, `Compra na Steam`, `Recebido de graça` e `Acesso antecipado` adiciona cliques desnecessários e aciona o teclado virtual no mobile. Já nos comboboxes reais (`Jogo` com 59 itens e `Idioma` com 29 itens), `renderCatalog()` descarta `review_count`, impedindo que o usuário veja o volume de cada opção antes de filtrar.
  - **Fix**: Exibir `review_count` formatado (`tabular-nums`) ao lado de cada opção nos menus de `Jogo` e `Idioma`, agrupar os 7 filtros da sidebar em seções semânticas e converter os 4 seletores tri-estado para controles de seleção direta (ou combobox `readonly` sem digitação).
  - **Suggested command**: `/impeccable polish`

- **[P3] What**: **Estado de erro genérico (`#load-error`) e ausência de feedback de carregamento (`aria-busy`) nos gráficos, rankings e tabela** (`frontend/src/pages/index.astro:311-314`, `frontend/src/scripts/dashboard.ts:868-870`, `frontend/src/styles/global.css:420-422`).
  - **Why it matters**: Quando a API local falha, o painel mostra apenas `"Não foi possível carregar os dados."` sem informar o status ou se o servidor FastAPI (`:8000`) está inacessível. Durante recarregamentos (`aria-busy="true"`), apenas `.figure` reduz opacidade para `0.5`, enquanto gráficos e tabela parecem congelados.
  - **Fix**: Incluir diagnóstico conciso na mensagem de erro e aplicar feedback visual uniforme de `aria-busy="true"` nos cartões de gráficos, rankings e `tbody`, além de aplicar `inert` no `<main>` quando o drawer mobile estiver aberto (`setMobileSidebar`).
  - **Suggested command**: `/impeccable harden`

#### Persona Red Flags

**Alex (Power User)**: Precisa abrir dropdowns de busca textual para alternar filtros binários simples (`Acesso antecipado: Sim`); clica nas barras de `#rank-games` e `chart-playtime` para filtrar e nada acontece; copia a URL do navegador para compartilhar um recorte e perde todos os filtros porque não há query string; fica preso em paginação estritamente sequencial (`Anterior` / `Próxima`) sem salto para a primeira página ou ordenação.

**Sam (Accessibility-Dependent User)**: Gráficos `<canvas>` (`#chart-month` e `#chart-playtime`) não possuem resumo acessível dinâmico (`aria-label` descritivo); volume de avaliações em `#rank-languages` e texto integral dos trechos na tabela dependem exclusivamente do atributo nativo `title` (inacessível via teclado e leitores de tela); quando o menu mobile abre em tela cheia (`.sidebar-panel.is-open`), o `<main>` ao fundo não recebe `inert` e continua capturando foco do Tab.

**Marina (Tech Lead / Avaliadora Técnica de Portfólio — derivada de `PRODUCT.md`)**: Lê no `README.md` sobre a inflexão da janela de 2h de reembolso da Steam, a "Economia da Insatisfação" e a correção de underflow `uint32` em `votes_funny`, mas ao abrir o dashboard não encontra referência visual à marca de 2h no gráfico de tempo de jogo nem vê `votes_funny`, `created_at` ou badges de *Acesso Antecipado* na tabela de avaliações.

#### Minor Observations

- **Barra mobile sem título (`index.astro:9-24`, `global.css:107-118`)**: Em viewports `< 768px`, `.sidebar-mobile-bar` renderiza apenas o ícone hambúrguer alinhado à direita; o usuário não vê "Reviews da Steam" até abrir o gaveteiro de filtros.
- **Tensão espacial no `.stamp-rule` do KPI de Recomendação (`index.astro:325-328`, `global.css:401-408`)**: A linha decorativa absoluta (`top: calc(100% + 4px)`) dentro de um container com `gap-3` (`12px`) fica colada entre o número e a legenda `"positivas no recorte"`.
- **Concordância nos placeholders dos filtros (`index.astro:209-256`)**: `"Recebido de graça"` e `"Acesso antecipado"` usam `placeholder="Todas"` (feminino) em vez de `"Todos"`.
- **Ícones mudos no trilho recolhido (`index.astro:74-291`)**: Os 9 ícones na barra de `60px` não possuem `title` nem indicador visual de filtro ativo antes de expandir o trilho.
- **Corte abrupto na atualização do ECharts (`charts.ts:126`, `charts.ts:197`)**: `animation: false` em `setOption` contrasta com a interpolação suave de `360ms` nos KPIs logo acima.

#### Questions to Consider

- "E se os filtros ativos ficassem sempre visíveis como chips removíveis no topo do palco principal (e sincronizados na URL), libertando o usuário de precisar reabrir a barra lateral para lembrar qual recorte está analisando?"
- "Como o gráfico `Recomendação por tempo de jogo` contaria imediatamente a história da janela de reembolso de 2 horas da Valve se demarcasse esse limiar e exibisse a taxa de base (`82,97%`) como referência?"
- "O que muda na fluidez exploratória se cada barra de `chart-playtime` e cada item de `Volume por jogo` e `Aprovação por idioma` funcionar como filtro clicável de 1 clique?"
- "E se a tabela dedicasse metade da largura ao texto da avaliação e revelasse os metadados que a API já retorna (`created_at`, `votes_funny`, `early_access`, `steam_purchase`)?"
