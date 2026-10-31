---
target: frontend/src/pages/index.astro
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:1de88b89ace499f8de5192af4f5274f57051cbfaf0c5244326138ac71a2a7509"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-10-31T18-55-02Z
slug: frontend-src-pages-index-astro
closed: true
---
Method: dual-agent (A: eda23003-1cd4-44ac-813b-3c5209d7d71e · B: ceda6ebf-0e30-4e31-a362-464129f5b472)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `#context-bar`, `#active-chips`, `.is-filtered` e `aria-busy` funcionam bem; porém `fetchCharts` resolve após `renderMetrics`/`renderReviews`, mantendo opacidade `0.5` até o fim. |
| 2 | Match System / Real World | 3 | Ótima localização `pt-BR`, marco de `2h` e badges (`Chave externa`, `Acesso antecipado`); coluna `Horas` na tabela omite unidade `"h"` e `#rank-languages` ordena por volume mas desenha barras por aprovação. |
| 3 | User Control and Freedom | 3 | Chips removíveis, botão `"Limpar todos"` e cross-filtering reversível em 1 clique; contudo, `syncUrl()` usa `replaceState` em vez de `pushState`, impedindo desfazer filtros com o botão Voltar do navegador. |
| 4 | Consistency and Standards | 2 | Os 4 filtros ternários (`Recomendação`, `Compra na Steam`, `Recebido de graça`, `Acesso antecipado`) ainda usam `<input type="text" role="combobox">` editável para apenas 3 estados (`Todos`/`Sim`/`Não`). |
| 5 | Error Prevention | 3 | Controle de concorrência (`++requestId`) e reversão no blur do combo; porém o hover na sidebar (`60px` → `300px`) empurra o `<main>` em `240px` e força reflow contínuo nos gráficos. |
| 6 | Recognition Rather Than Recall | 2 | Chips no topo e linha `Base 83,0%` no gráfico ajudam, mas os cartões de KPI perdem o referencial da base (`1.000.000` / `82,97%`) quando filtrados, e o trilho de `60px` esconde os 7 controles atrás de ícones. |
| 7 | Flexibility and Efficiency | 2 | Cross-filtering de 1 clique nos rankings e no gráfico de horas acelerou o uso, mas filtros booleanos ainda exigem abrir dropdown e faltam atalhos para as teses do estudo. |
| 8 | Aesthetic and Minimalist Design | 4 | Paleta editorial consistente, tipografia tabular rigorosa e uso semântico preciso de `--accent` e `--negative`. |
| 9 | Error Recovery | 3 | `#load-error-detail` informa a falha da API e o endpoint local (`:8000`), mas se o erro ocorrer após trocar um filtro, os KPIs e a tabela mantêm os números do recorte anterior abaixo do alerta. |
| 10 | Help and Documentation | 2 | Subtítulos orientam o clique nos gráficos e a expansão na tabela, mas falta uma nota metodológica in-app evidenciando o saneamento (`uint32` em `votes_funny`, copypasta, 4 partições Kaggle). |
| **Total** | | **29/40** | **Good (72,5% — evolução de +5 pontos sobre a rodada anterior, subindo da faixa Acceptable para Good)** |

#### Design Specificity Verdict

**LLM assessment**: O dashboard deu um salto claro de especificidade de domínio: a **janela de reembolso de 2 horas da Valve** (`<1 h` e `1–2 h` em `--negative`), a linha de referência tracejada (`Base 83,0%` / `82,97%`), o cross-filtering bidirecional em 1 clique e os badges de telemetria em cada linha da tabela (`Acesso antecipado`, `Recebido de graça`, `Chave externa`, `engraçados`, `coment.`) ancoram a interface diretamente no universo da Steam. O que ainda limita a especificidade é: (1) o trilho lateral auto-retrátil no desktop (`60px` → `300px` no hover), que esconde a mesa de filtros e desloca o palco principal em `240px`; (2) os 4 cartões de KPI com sub-rótulos estáticos (`"no recorte"`) que não mostram a proporção ou variação (`p.p.`) contra a base de 1M de avaliações; e (3) a ausência de recortes guiados de 1 clique para demonstrar imediatamente as teses do estudo (como a *"Economia da Insatisfação"* e a queda de `-14 p.p.` no Acesso Antecipado).

**Deterministic scan**:
- Varredura estática (`impeccable detect --json frontend/src/pages/index.astro` e `frontend/src`): **0 problemas** (`exit code 0`).
- Varredura em DOM vivo no desktop (`impeccable detect --json http://localhost:4321` @ `1280x800`): **0 problemas** (`exit code 0` — o antigo alerta `cramped-padding` em `div.sheet` foi 100% eliminado).
- Varredura em DOM vivo no mobile (`impeccable detect --viewport 390x844 --json http://localhost:4321`): **3 avisos tipográficos leves (`straggler`, severity `advisory`)** em `index.astro:365`, `index.astro:378` e `index.astro:386`, onde a última palavra dos subtítulos `.meta` (`"filtrar"` e `"detalhes"`) quebra sozinha na segunda linha em telas de `390px` de largura por falta de `text-wrap: pretty` em `.meta`.

**Visual overlays**: Nenhuma sobreposição visual interativa está disponível em aba do usuário (`no browser automation tool exposed in harness; live overlay injection skipped`), mas a aplicação ativa em `http://localhost:4321` foi inspecionada via `impeccable detect` em viewports desktop e mobile.

#### Overall Impression

A evolução de **24/40 para 29/40** transformou um painel passivo em uma ferramenta analítica viva: clicar numa barra de tempo de jogo ou em um título do ranking, ver o chip surgir no topo e expandir uma avaliação real com seus badges de aquisição funciona com fluidez. O próximo salto (de **Good** para **Excellent**) está em estabilizar a geometria da barra lateral no desktop, substituir os comboboxes de texto dos 4 filtros ternários por controles diretos de 1 clique e dar contexto comparativo aos KPIs (`% do total` e `delta p.p. vs. base`).

#### What's Working

1. **Codificação visual da janela de reembolso de 2h e linha de base no gráfico de tempo (`charts.ts:240-333`)**: As faixas `<1 h` (`lt1`) e `1–2 h` (`h1_2`) em `--negative` abaixo da `markLine` tracejada (`Base 83,0%`) comunicam visualmente a principal descoberta do estudo logo no primeiro olhar, e o clique alterna o filtro da faixa com destaque imediato em `--accent`.
2. **Barra de contexto (`#context-bar`) com chips ativos e contagens nos comboboxes (`dashboard.ts:541-666`, `dashboard.ts:682-711`)**: O usuário sabe a todo momento quais filtros estão aplicados, remove qualquer filtro individualmente em 1 clique e enxerga o volume (`review_count` em `tabular-nums`) ao lado de cada jogo e idioma nos menus.
3. **Acessibilidade semântica e linhas de avaliação expansíveis com metadados (`dashboard.ts:354-386`, `dashboard.ts:889-975`, `charts.ts:139-148`)**: Uso de `inert` e devolução de foco no drawer mobile, `aria-label` estatístico dinâmico nos gráficos ECharts e expansão via clique/`Enter`/`Espaço` revelando o texto completo e os badges de telemetria (`created_at`, `early_access`, `received_for_free`, `!steam_purchase`, `votes_funny`, `comment_count`).

#### Priority Issues

- **[P1] What**: **A expansão da barra lateral no hover (`60px` → `300px`) empurra o `<main>` em 240px e força reflow contínuo dos gráficos ECharts** (`frontend/src/styles/global.css:300-318`, `frontend/src/scripts/charts.ts:74`).
  - **Why it matters**: Como `.sidebar-panel` é irmão flex de `<main class="min-w-0 flex-1">`, cruzar a borda esquerda com o mouse redimensiona toda a área de leitura durante `300ms` na ida e na volta, redesenhando os canvases a cada frame e escondendo os rótulos dos 7 filtros quando o cursor volta para os gráficos.
  - **Fix**: Em desktops (`min-width: 1024px`), manter a barra lateral permanentemente aberta com largura estável (`272px`–`280px`) sem colapsar para `60px` no hover; em telas intermediárias (`768px–1023px`), se recolhida a `60px`, expandir como camada sobreposta (`position: fixed`) para nunca deslocar a largura do `<main>`.
  - **Suggested command**: `/impeccable layout`

- **[P1] What**: **Os 4 filtros ternários (`Recomendação`, `Compra na Steam`, `Recebido de graça`, `Acesso antecipado`) continuam usando `<input type="text" role="combobox">` editável e sem agrupamento semântico** (`frontend/src/pages/index.astro:140-263`, `frontend/src/scripts/dashboard.ts:436-447`).
  - **Why it matters**: Apresentar escolhas de 3 estados (`Todos` / `Sim` / `Não`) como caixas de busca textual exige abrir um menu flutuante (2 cliques) para uma decisão binária, anuncia `"caixa de combinação editável"` em leitores de tela e deixa a barra lateral com 7 caixas de texto idênticas sem separação entre *Catálogo*, *Avaliação & Tempo* e *Aquisição & Lançamento*.
  - **Fix**: Converter os 4 filtros ternários em controles segmentados compactos de 3 botões (`Todos | Sim | Não` ou `Todas | Positiva | Negativa`) de clique único e agrupar os 7 filtros da sidebar em 3 blocos semânticos claros.
  - **Suggested command**: `/impeccable distill`

- **[P2] What**: **Cartões de KPI perdem o referencial da base completa quando filtrados (exibindo apenas `"no recorte"`) e faltam recortes guiados para as teses do estudo** (`frontend/src/pages/index.astro:326-353`, `frontend/src/scripts/dashboard.ts:734-740`).
  - **Why it matters**: Quando o avaliador filtra por `Acesso antecipado: Sim` (`69,8%`), o card de Recomendação mostra apenas `"positivas no recorte"`, sem explicitar a queda de `-13,2 p.p. vs. base (82,97%)`, e o card de Avaliações não mostra a fatia percentual sobre `1.000.000`. Além disso, um recrutador avaliando o portfólio não tem atalhos de 1 clique para ver imediatamente os achados do estudo (*Janela < 2h*, *Acesso Antecipado*, *Economia da Insatisfação*).
  - **Fix**: Atualizar dinamicamente as legendas `.meta` abaixo dos 4 KPIs com a comparação contra a base global (ex.: `"5,4% da base (1M)"`, `"-13,2 p.p. vs. base 82,97%"`) e oferecer pílulas discretas de recortes analíticos na barra de contexto.
  - **Suggested command**: `/impeccable clarify`

- **[P2] What**: **Dissonância visual em `"Aprovação por idioma"` (ordenado por volume, mas com barras de aprovação sem marca de referência) e falta de unidade `"h"` e nota de saneamento na tabela** (`frontend/src/scripts/dashboard.ts:825-856`, `frontend/src/scripts/dashboard.ts:907-908`, `frontend/src/pages/index.astro:376-403`).
  - **Why it matters**: Em `#rank-languages`, as barras `.rank-fill` representam `rate * 100`, mas a lista segue a ordem de `review_count`, criando barras que sobem e descem sem ordem aparente ao lado de `#rank-games`. Na tabela, a coluna `Horas` exibe `14,20` sem `" h"`, e o rigor do saneamento de dados (`votes_funny` `uint32`, truncamento de copypasta) não é documentado na interface.
  - **Fix**: Ordenar `#rank-languages` pela taxa de aprovação (ou exibir marcador vertical da base `83%` na trilha), adicionar sufixo `" h"` na coluna `Horas` e incluir uma nota metodológica concisa no rodapé/cabeçalho da tabela sobre o saneamento das 4 partições Kaggle.
  - **Suggested command**: `/impeccable polish`

- **[P3] What**: **`syncUrl()` sobrescreve o histórico com `replaceState` (quebrando o botão Voltar), `.meta` gera 3 órfãs tipográficas (`straggler`) no mobile e botões mobile têm `32×32px`** (`frontend/src/scripts/dashboard.ts:1158-1165`, `frontend/src/styles/global.css:128-139`, `frontend/src/styles/global.css:394-400`).
  - **Why it matters**: Usar `replaceState` em toda mudança de filtro impede que o botão **Voltar** do navegador desfaça os filtros aplicados na sessão; no mobile (`390x844`), `impeccable detect` apontou 3 quebras de palavra isolada (`"filtrar"` e `"detalhes"`) nos subtítulos `.meta`, e `.sidebar-burger`/`.sidebar-close` (`32×32px`) ficam abaixo do alvo de toque de `44×44px`.
  - **Fix**: Usar `history.pushState` em mudanças de filtro/página iniciadas pelo usuário (`replaceState` apenas na hidratação inicial), adicionar `text-wrap: pretty` em `.meta` (e `&nbsp;` nos pares finais dos subtítulos), aumentar `.sidebar-burger`/`.sidebar-close` para `44×44px` e adicionar foco explícito `tr.review-row:focus-visible td`.
  - **Suggested command**: `/impeccable harden`

#### Persona Red Flags

**Alex (Power User)**: Ao mover o mouse até a esquerda para ajustar um filtro, a sidebar expande de `60px` para `300px` e desloca os gráficos sob o cursor; para ligar `Acesso antecipado: Sim`, ainda precisa abrir um dropdown de texto; ao clicar no botão **Voltar** do mouse após aplicar 3 filtros, sai do site porque `syncUrl()` usa `replaceState` em vez de `pushState`.

**Sam (Accessibility-Dependent User)**: Ouve 7 `"caixa de combinação editável"` seguidas na sidebar mesmo para opções simples de `Sim`/`Não`; o subtítulo de `#chart-playtime` diz `"clique para filtrar"`, mas o `<canvas>` só responde a clique de mouse (sem atalho de teclado direto no card, exigindo voltar até o combobox da sidebar); o outline de `:focus-visible` em `<tr class="review-row">` pode ser clipado pelas bordas de `.sheet` sem regra dedicada nas células `td`.

**Marina (Tech Lead / Avaliadora Técnica de Portfólio — derivada de `PRODUCT.md`)**: Vê a janela de reembolso de 2h muito bem destacada no gráfico, mas quando aplica um filtro não vê nos cartões de KPI o delta em pontos percentuais (`p.p.`) nem a fatia sobre `1.000.000`, e sente falta de atalhos rápidos para inspecionar as demais teses do estudo (*Economia da Insatisfação* e *Acesso Antecipado*) e de uma nota técnica sobre o saneamento (`uint32` underflow em `votes_funny`).

#### Minor Observations

- **Três `stragglers` tipográficos no mobile (`index.astro:365, 378, 386`, `global.css:394`)**: Em `390x844`, as palavras `"filtrar"` e `"detalhes"` sobram sozinhas na última linha dos parágrafos `.meta`.
- **Coluna `"Horas"` sem unidade (`dashboard.ts:908`)**: Exibe `1,50` em vez de `1,50 h`.
- **Alvos de toque de `32×32px` no mobile (`global.css:128-139`)**: `.sidebar-burger` e `.sidebar-close` têm `32px`, enquanto o restante do sistema respeita `44px`.
- **Ordem de pintura no `load()` (`dashboard.ts:1134-1147`)**: `renderMetrics` e `renderReviews` pintam antes de `await chartsPromise`, mantendo `aria-busy="true"` (`opacity: 0.5`) sobre números já atualizados.

#### Questions to Consider

- "E se a barra lateral permanecesse aberta e estável no desktop (`276px`), com os 4 filtros ternários convertidos em controles segmentados de 1 clique (`Todos | Sim | Não`), eliminando de vez o pulo de 240px nos gráficos?"
- "Quanto mais impacto o estudo causa em um avaliador técnico se os 4 KPIs mostrarem a comparação em tempo real contra a base (`% de 1M` e `±p.p. vs. 82,97%`) e a barra de contexto trouxer atalhos de 1 clique para as teses do projeto (*Janela < 2h*, *Acesso Antecipado*, *Economia da Insatisfação*)?"
- "Como uma nota metodológica discreta no rodapé da tabela pode evidenciar o trabalho de engenharia de dados (auditoria 1:1 das 4 partições Kaggle, correção de underflow `uint32` em `votes_funny` e truncamento de copypasta) sem adicionar ruído visual?"
