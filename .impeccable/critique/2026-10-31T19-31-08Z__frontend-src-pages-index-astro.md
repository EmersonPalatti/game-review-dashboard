---
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:eac5659f4374a8a818f1bf08f1321aae89182d34b3ace363aa7053774a1772f3"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-10-31T19-31-08Z
slug: frontend-src-pages-index-astro
closed: true
---
Method: dual-agent (A: 84e2928e-0913-4452-8e19-9de39f9f8066 · B: 234856e7-36a1-4852-bce4-e7fa3c5765e9)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | `load()` resolve `Promise.all` atomicamente, `aria-busy="true"` exibe barra de progresso editorial de `2px` (`@keyframes chart-progress`) e os gráficos/rankings interpolam continuamente (`320–360 ms`). |
| 2 | Match System / Real World | 4 | `formatHours` inclui unidade explícita (`" h"`), `#rank-languages` ordena monotonicamente por taxa de aprovação e a janela de reembolso (`< 2 h`) e badges refletem o domínio da Steam. |
| 3 | User Control and Freedom | 4 | `syncUrl()` registra mudanças do usuário com `history.pushState` e restaura via `popstate`; chips removíveis, `"Limpar todos"` e cross-filtering reversível em 1 clique. |
| 4 | Consistency and Standards | 3 | Os 4 filtros ternários agora usam controles segmentados (`.seg-control`) agrupados em 3 seções `.filter-group`; contudo, as 3 linhas `SearchCombo` ainda aninham `<input>` + `<button class="combo-toggle">` + `<ul role="listbox">` dentro de `<label>` (violação W3C HTML §4.10.4). |
| 5 | Error Prevention | 4 | A sidebar desktop permanece aberta e estável em `288px` (`sticky`), eliminando o deslocamento de `240px` no `<main>` e o reflow contínuo dos gráficos ao mover o mouse. |
| 6 | Recognition Rather Than Recall | 4 | Os 4 cartões de KPI exibem dinamicamente a comparação contra a base global (`% de 1.000.000`, `±p.p. vs. base (82,97%)`, `de 59 no catálogo`, `% de 912.553 contas`) e a sidebar exibe todos os rótulos permanentemente. |
| 7 | Flexibility and Efficiency | 3 | `#thesis-presets` oferece recortes guiados em 1 clique (*Janela < 1 h*, *Acesso antecipado*, *Economia da insatisfação*); falta um affordance visual explícito (chevron) nas linhas expansíveis da tabela e um atalho rápido de teclado (`/` para buscar jogo). |
| 8 | Aesthetic and Minimalist Design | 4 | Paleta editorial consistente, `h1.wordmark` em `20px/26px` (`1.25:1`), `tabular-nums` universal, `text-wrap: pretty` sem órfãs no mobile e **0 alertas** no `impeccable detect` (desktop e mobile `390×844`). |
| 9 | Error Recovery | 3 | `#load-error` informa a falha e permite tentar novamente, mas quando um filtro subsequente falha, `aria-busy` volta para `false` e os números/gráficos do recorte anterior permanecem ativos abaixo do alerta sem marcação de estado obsoleto (`data-stale`). |
| 10 | Help and Documentation | 3 | Nota metodológica no rodapé documenta a partição 1:1 das 4 tabelas do Kaggle, o saneamento do underflow `uint32` em `votes_funny` e o truncamento em `280` caracteres; em dispositivos touch, a tese ativa nos presets depende de `title` (hover) para explicação detalhada. |
| **Total** | | **36/40** | **Excellent (90,0% — evolução de +7 pontos sobre a rodada anterior: `24 → 29 → 36`)** |

#### Design Specificity Verdict

**LLM assessment**: A interface atingiu maturidade de produto autoral e analítico: a barra de recortes guiados (`#thesis-presets`) entrega em 1 clique as três descobertas empíricas de `analysis.ipynb` (*Janela < 1 h*, *Acesso antecipado*, *Economia da insatisfação*), os 4 KPIs calculam em tempo real o delta em pontos percentuais (`p.p.`) e a fração sobre `1.000.000` de avaliações, a sidebar desktop de `288px` com controles segmentados eliminou o salto de layout e os gráficos ECharts + barras de ranking interpolam seus estados continuamente (`320–360 ms`). O que resta para o acabamento final são detalhes cirúrgicos de semântica HTML/acessibilidade (`<label>` envolvendo múltiplos elementos interativos nos 3 `SearchCombo`, duas regiões `aria-live="polite"` simultâneas, `tabindex="0"` na região de rolagem horizontal `.sheet`), invalidação visual de dados obsoletos sob erro de rede e um indicador visual (chevron) de expansão nas linhas da tabela.

**Deterministic scan**:
- Varredura em DOM vivo no desktop (`impeccable detect --json http://localhost:4321` @ `1280×800`): **0 problemas** (`[]`, `exit code 0`).
- Varredura em DOM vivo no mobile (`impeccable detect --viewport 390x844 --json http://localhost:4321`): **0 problemas** (`[]`, `exit code 0` — os 3 alertas `straggler` da rodada anterior e o alerta `flat-type-hierarchy` foram 100% resolvidos).

**Visual overlays**: Nenhuma sobreposição visual interativa ativa no navegador do usuário (`no browser automation tool exposed in harness; live overlay injection skipped`), mas a página ao vivo em `http://localhost:4321` foi auditada pelo detector em viewports desktop e mobile com `0` violações.

#### Overall Impression

O dashboard avançou de **24/40 (Acceptable)** para **29/40 (Good)** e agora para **36/40 (Excellent)**. A experiência de exploração é coesa, rápida e fiel ao estudo de 1 milhão de reviews da Steam: clicar em *"Economia da insatisfação"* ou *"Acesso antecipado"*, observar os KPIs compararem o recorte contra a média global de `82,97%` e ver as barras de tempo de jogo e de idiomas se acomodarem suavemente na nova distribuição transmite rigor de engenharia e clareza editorial. Os pontos remanescentes são polimentos técnicos de conformidade W3C/WCAG, resiliência em falha de rede e descoberta visual na tabela.

#### What's Working

1. **Barra de recortes guiados (`#thesis-presets`) + KPIs comparativos dinâmicos (`index.astro:282-323`, `dashboard.ts:476-520, 797-831`)**: Avaliadores técnicos conseguem inspecionar os achados centrais do estudo em 1 clique e ler imediatamente o impacto em pontos percentuais (`±p.p. vs. base 82,97%`) e proporção sobre `1.000.000` de reviews.
2. **Estabilidade da sidebar desktop (`288px`) com grupos semânticos e controles segmentados (`index.astro:74-255`, `global.css:283-299, 487-583`)**: A remoção do colapso de `60px` eliminou o reflow de `240px` nos gráficos ECharts, enquanto os controles `.seg-control` reduziram para 1 clique a filtragem ternária (`Todas | Sim | Não`).
3. **Interpolação contínua de dados e barra de progresso editorial (`charts.ts:16-30, 165-356`, `dashboard.ts:833-974`, `global.css:480-522, 864-883`)**: Os gráficos ECharts interpolam séries com `{ notMerge: false }` em `320–360 ms`, as barras `.rank-fill` transicionam via `transform: scaleX` a partir de `previousRankScales` com stagger de `20 ms`, e `prefers-reduced-motion` + `ViewTransition` desativam animações espaciais de forma limpa.

#### Priority Issues

- **[P1] What**: **Elementos interativos múltiplos (`<input>` + `<button class="combo-toggle">` + `<ul role="listbox">`) aninhados dentro de `<label>` nas 3 linhas de `SearchCombo` e regiões `aria-live="polite"` duplicadas** (`frontend/src/pages/index.astro:76-168, 267, 280`).
  - **Why it matters**: A especificação W3C HTML (§4.10.4) proíbe que um `<label>` contenha múltiplos descendentes interativos (`<input>` e `<button>`). Isso gera HTML inválido, faz leitores de tela concatenarem o rótulo do botão ao nome acessível do input e pode redirecionar cliques do menu para o input. Além disso, atualizar `#filter-summary` e `#active-chips` simultaneamente com `aria-live="polite"` faz leitores de tela enfileirarem dois anúncios concorrentes a cada clique.
  - **Fix**: Trocar o contêiner externo das 3 linhas de `SearchCombo` de `<label class="sidebar-row is-field">` para `<div class="sidebar-row is-field">` (igual às 4 linhas segmentadas), transformar `<span class="field-label">` em `<label for="filter-app" class="field-label">` explícito, e remover `aria-live="polite"` de `#filter-summary` (mantendo-o apenas em `#active-chips`).
  - **Suggested command**: `/impeccable harden`

- **[P1] What**: **Persistência de dados defasados com aparência ativa quando uma requisição filtrada falha na API** (`frontend/src/scripts/dashboard.ts:1220-1228`, `frontend/src/styles/global.css:515-522`).
  - **Why it matters**: Se a API local cair ou retornar erro após o usuário clicar em um filtro ou preset, `#load-error` aparece no topo e os chips do novo filtro são exibidos no cabeçalho, mas no bloco `finally` o `aria-busy` volta para `'false'` e os números, gráficos e avaliações da seleção anterior permanecem com `opacity: 1`, induzindo à leitura de números que não correspondem aos filtros ativos no cabeçalho.
  - **Fix**: Em `load()`, definir `main.dataset.error = 'true'` no bloco `catch` (e remover `delete main.dataset.error` no início do `try` após sucesso), aplicando em `global.css` `#dashboard-main[data-error='true'] section { opacity: 0.35; pointer-events: none; filter: grayscale(0.5); }` para sinalizar inequivocamente que os dados exibidos estão obsoletos até que a reconexão ocorra.
  - **Suggested command**: `/impeccable harden`

- **[P2] What**: **Falta de indicador visual explícito (chevron) de expansão nas linhas da tabela (`tr.review-row`) e de dica de contexto para presets em telas touch** (`frontend/src/scripts/dashboard.ts:983-1069`, `frontend/src/styles/global.css:958-1005`, `frontend/src/pages/index.astro:282-287`).
  - **Why it matters**: A expansão das linhas da tabela para revelar o texto completo de `280` caracteres e os badges de telemetria depende exclusivamente de o usuário ler o subtítulo da seção (`"Clique ou pressione Enter em uma linha para expandir detalhes"`). Da mesma forma, em dispositivos touch (sem hover para `title`), clicar em *"Economia da insatisfação"* filtra `Recomendação: Não recomenda`, mas não exibe no subtítulo de contexto a tese associada (`2,8× mais votos úteis nas avaliações negativas`).
  - **Fix**: Adicionar um indicador visual discreto (`▸` / chevron SVG em `.excerpt-line` que rotaciona `90deg` quando `tr.review-row.is-expanded` está ativo) na coluna `Trecho`, e quando um preset de `#thesis-presets` estiver ativo, exibir sua nota analítica diretamente em `#context-subtitle`.
  - **Suggested command**: `/impeccable clarify`

- **[P2] What**: **Contêiner de rolagem horizontal da tabela (`.sheet`) sem foco de teclado (`tabindex="0" role="region"`) e `#theme-toggle` sem `aria-label` estável** (`frontend/src/pages/index.astro:45-72, 358-373`).
  - **Why it matters**: Em viewports menores que `768px`, `.sheet` possui `overflow-x: auto` para rolar a tabela de `min-width: 768px`, mas sem `tabindex="0"` usuários de teclado não conseguem rolar horizontalmente com as setas (WCAG 2.1.1). Já `#theme-toggle` usa `aria-pressed` mas seu texto visível alterna entre `"Escuro"` e `"Claro"`, fazendo leitores de tela anunciarem `"Escuro, botão de alternância, não pressionado"` no modo claro em vez de um rótulo estável.
  - **Fix**: Adicionar `tabindex="0" role="region" aria-label="Tabela de avaliações"` em `<div class="sheet">` e `aria-label="Alternar tema claro e escuro"` em `<button id="theme-toggle">`.
  - **Suggested command**: `/impeccable harden`

- **[P3] What**: **`SearchCombo.setOptions()` não atualiza o texto exibido quando `setCommitted()` foi chamado antes do carregamento das opções, e falta atalho rápido `/` para focar a busca de jogo** (`frontend/src/scripts/dashboard.ts:137-140, 1244-1295`).
  - **Why it matters**: Se a URL inicial contiver `?app_id=105600` e `setOptions()` receber o catálogo atualizado, chamar `this.showCommitted()` dentro de `setOptions()` quando o input não está em edição garante que o nome do jogo apareça imediatamente. Além disso, pressionar `/` (fora de inputs) para focar `#filter-app` acelera a navegação de avaliadores técnicos.
  - **Fix**: Em `SearchCombo.setOptions()`, adicionar `if (!this.open && document.activeElement !== this.input) this.showCommitted();` e adicionar um listener de teclado para `/` que foca `appInput`.
  - **Suggested command**: `/impeccable polish`

#### Persona Red Flags

**Alex (Power User / Tech Lead)**: Aprecia muito os presets de 1 clique, a animação fluida de `340ms` e o botão Voltar funcionando via `pushState`; porém gostaria de pressionar `/` no teclado para buscar um jogo imediatamente e notar um chevron visual indicando que as linhas da tabela expandem.

**Sam (Accessibility-Dependent User)**: No leitor de tela, os 3 `SearchCombo` (`Jogo`, `Idioma`, `Tempo na avaliação`) têm `<button class="combo-toggle">` dentro de `<label>`, misturando o rótulo do botão ao nome do combobox; ao filtrar, `#filter-summary` e `#active-chips` disparam `aria-live="polite"` ao mesmo tempo; em telas estreitas, `<div class="sheet">` não recebe foco de teclado para rolagem horizontal.

**Jordan (Recrutador / First-Timer em Mobile Touch)**: Ao tocar no preset *"Economia da insatisfação"* no celular (`390×844`), não vê o `title` de hover que explica por que o filtro selecionou `Recomendação: Não` (`2,8× mais votos úteis e o dobro da mediana de caracteres`).

#### Minor Observations

- **Tooltip do gráfico mensal (`charts.ts:173-180`)**: Enquanto o gráfico de tempo de jogo informa `"Clique para filtrar a faixa"`, o gráfico mensal é apenas histórico; vale manter essa distinção clara.
- **`SearchCombo.setOptions()` (`dashboard.ts:137-140`)**: Chamar `this.showCommitted()` quando `!this.open` torna o componente resiliente à ordem de inicialização.

#### Questions to Consider

- "Quer que eu execute agora os ajustes finais de **P1, P2 e P3** (semântica `<label for=...>` nos 3 combos, estado `data-error` para dados obsoletos, chevron nas linhas expansíveis da tabela, resumo da tese ativa em `#context-subtitle`, `tabindex="0"` em `.sheet` e atalho `/`) para fechar com nota máxima?"
