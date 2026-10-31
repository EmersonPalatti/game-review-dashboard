---
target: frontend/src/pages/index.astro
total_score: 37
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:5205a5de7f03606ea96e7f371369374aa6cb9ed403c9b71831c5cabb722c98e2"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-10-31T19-49-08Z
slug: frontend-src-pages-index-astro
---
Method: dual-agent (A: f2d8efd4-697f-4903-963a-f8c6ffd68645 · B: aeec87e1-5f3b-41e2-b5b7-3f63aaf4aca6)

### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Barra de progresso editorial de `2px`, região viva única em `#active-chips`, subtítulos comparativos nos 4 KPIs e invalidação visual (`data-error="true"`) em falhas de rede |
| 2 | Match System / Real World | 4 | Linguagem nativa do ecossistema Steam (*janela de reembolso < 2 h*, *acesso antecipado*, *chave externa*), formatação `pt-BR` com `" h"` e `p.p.` |
| 3 | User Control and Freedom | 3 | Tabela de avaliações restrita à ordem cronológica fixa e paginação sequencial sem ordenação por colunas (*Votos úteis* / *Horas*) |
| 4 | Consistency and Standards | 4 | Sistema coeso de tokens, grupos semânticos e HTML válido W3C; leve divergência no foco interno de `.field-control:focus-visible` e flexão `Todas`/`Todos` |
| 5 | Error Prevention | 4 | Comboboxes validados contra opções reais, controles segmentados ternários e limites de paginação travados |
| 6 | Recognition Rather Than Recall | 4 | Chips ativos persistentes, nota da tese ativa visível em `#context-subtitle`, contagens por opção nos combos e chevron `.excerpt-chevron` nas linhas |
| 7 | Flexibility and Efficiency | 3 | Navegar com setas (`ArrowDown`/`ArrowUp`) no `SearchCombo` e pressionar `Tab` descarta a opção destacada em vez de confirmá-la; atalho `/` sem badge visual `<kbd>` |
| 8 | Aesthetic and Minimalist Design | 4 | Identidade editorial papel-e-tinta (`IBM Plex Sans` + `IBM Plex Mono`), interpolação GPU `scaleX` nos rankings e morphing contínuo no ECharts |
| 9 | Error Recovery | 3 | Estado vazio da tabela (`0` avaliações) informa a ausência de dados, mas não oferece botão direto de *"Limpar filtros"* no próprio corpo da tabela |
| 10 | Help and Documentation | 4 | Metodologia explícita no rodapé, referências de base (`82,97%` / `1M`) nos KPIs e explicação inline dos presets editoriais |
| **Total** | | **37/40** | **Excellent** |

### Design Specificity Verdict

**LLM assessment**: A interface consolidou-se como um **observatório editorial autoral sobre 1.000.000 de avaliações da Steam**. A combinação de papel aquecido (`--paper: #f4f4f2`), tinta profunda (`--ink: #1c1915`), verde-pinho (`--accent: #1f4e46`) e ferrugem (`--negative: #9e3a26`) com tipografia `IBM Plex Sans` e numerais tabulares em `IBM Plex Mono` evita qualquer aparência de template SaaS genérico. Os três presets de tese no topo (`#thesis-presets`), a linha de referência `Base 83,0%` com destaque cromático para a janela de reembolso da Valve (`< 1 h` e `1–2 h`), o morphing suave das séries temporais/barras e o indicador `.excerpt-chevron` de expansão das resenhas demonstram altíssimo nível de acabamento. As oportunidades restantes concentram-se na ergonomia avançada de teclado do combobox (`Tab` após seleção por setas), na capacidade analítica da tabela (ordenação por *Votos úteis* e *Horas* para comprovar na leitura individual a tese da *Economia da insatisfação*) e na recuperação direta em estados vazios (`0` resultados).

**Deterministic scan**: `impeccable detect` retornou **0 alertas (`[]`, exit code `0`)** em todas as 4 varreduras executadas:
- Markup estático (`frontend/src/pages/index.astro`): `0` findings.
- Live URL Desktop (`1280×800` em `http://localhost:4321`): `0` findings.
- Live URL Tablet (`768×1024` em `http://localhost:4321`): `0` findings.
- Live URL Mobile (`390×844` em `http://localhost:4321`): `0` findings.

**Visual overlays**: Nenhum overlay visível ao usuário está disponível nesta sessão (ferramenta de mutação/apresentação de aba `[Human]` indisponível no contexto do subagente; sinal de fallback registrado conforme protocolo).

### Overall Impression

O dashboard atingiu a faixa **Excellent (37/40)** com zero violações determinísticas em desktop, tablet e mobile. O próximo salto de qualidade está em refinar a ergonomia de teclado dos comboboxes, transformar a tabela inferior em uma ferramenta de investigação ordenável (*Votos úteis*, *Horas*, *Data*) e adicionar ação direta de recuperação quando um cruzamento de filtros resulta em zero avaliações.

### What's Working

1. **Transições Analíticas Coesas e Respeito à Acessibilidade ([`charts.ts#L168-L173`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/charts.ts#L168-L173), [`dashboard.ts#L868-L916`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L868-L916), [`global.css#L494-L522`](file:///c:/Projects/game-review-dashboard/frontend/src/styles/global.css#L494-L522))**: O morphing contínuo do ECharts (`320ms cubicOut`), a interpolação via GPU (`transform: scaleX`) nas barras de ranking com stagger de `20ms` e a barra de progresso editorial de `2px` durante `aria-busy="true"` dão fluidez orgânica às mudanças de recorte sem causar layout shift, desativando-se integralmente sob `prefers-reduced-motion: reduce` e durante o `ViewTransition` de tema.
2. **HTML Semântico W3C e Estado de Erro Seguro ([`index.astro#L80-L169`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro#L80-L169), [`dashboard.ts#L1283-L1288`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L1283-L1288), [`global.css#L517-L522`](file:///c:/Projects/game-review-dashboard/frontend/src/styles/global.css#L517-L522))**: Os 3 `SearchCombo` agora associam `<label for="...">` exclusivamente ao `<input role="combobox">`, mantendo `.combo-toggle` e `<ul role="listbox">` irmãos dentro de `.combo-root`, enquanto falhas de API aplicam `data-error="true"` em `#dashboard-main`, esmaecendo dados obsoletos (`opacity: 0.35; pointer-events: none`).
3. **Descoberta Progressiva e Contexto Editorial Sempre Visível ([`dashboard.ts#L696-L702`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L696-L702), [`dashboard.ts#L1068-L1119`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L1068-L1119))**: As linhas da tabela exibem o indicador `.excerpt-chevron` que rotaciona `90deg` em `var(--accent)` ao expandir metadados de aquisição e engajamento, e a tese ativa é explicada diretamente em `#context-subtitle` tanto no desktop quanto em dispositivos touch/mobile.

### Priority Issues

#### 1. [P1] What: Navegação com setas + `Tab` no `SearchCombo` descarta a opção destacada
- **Why it matters**: Quando o usuário abre um combobox (`#filter-app`, `#filter-language`, `#filter-playtime`), digita um prefixo (ex.: `"Arm"`) ou navega com `ArrowDown`/`ArrowUp` até destacar uma opção (`.is-active`, `aria-activedescendant`) e pressiona `Tab` para avançar ao próximo controle, o handler de `blur` chama [`finishEditing()`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L296-L312). Como `finishEditing()` compara apenas `this.input.value` por igualdade exata (`fold(item.label) === fold(typed)`), ele ignora `this.active` e reverte para `this.showCommitted()`, descartando a escolha feita pelo teclado.
- **Fix**: Em [`SearchCombo.onKey`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L314-L339), tratar `event.key === 'Tab'` quando `this.open` for `true`: se o usuário navegou com setas ou digitou uma busca (`this.query !== ''` ou `items[this.active]` difere de `this.committed`), confirmar `picked.value` via `this.commit(picked.value)` antes que o foco avance naturalmente para o próximo elemento.
- **Suggested command**: `/impeccable harden`

#### 2. [P2] What: Tabela de avaliações sem ordenação por colunas (*Votos úteis*, *Horas*, *Data*) nem atalhos de paginação
- **Why it matters**: A tese central da *Economia da insatisfação* demonstra que avaliações negativas recebem `2,8×` mais votos úteis (`7,08` vs `2,56`), mas [`list_reviews`](file:///c:/Projects/game-review-dashboard/backend/app/queries.py#L150-L170) e o cabeçalho da tabela em [`index.astro#L360-L374`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro#L360-L374) fixam a listagem em ordem cronológica (`timestamp_created DESC`). O analista não consegue ordenar a tabela por *Votos úteis* ou *Horas* para ler as resenhas mais emblemáticas de cada recorte.
- **Fix**: Adicionar suporte a ordenação (`sort_by`: `created_at` | `votes_helpful` | `playtime_hours`, `sort_dir`: `desc` | `asc`) no endpoint `/reviews` ([`main.py`](file:///c:/Projects/game-review-dashboard/backend/app/main.py), [`queries.py`](file:///c:/Projects/game-review-dashboard/backend/app/queries.py), [`schemas.py`](file:///c:/Projects/game-review-dashboard/backend/app/schemas.py)) e cabeçalhos ordenáveis `<button>` dentro dos `<th>` de *Horas* e *Votos úteis* com atributo `aria-sort` em [`index.astro`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro) e [`dashboard.ts`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts), além de atalhos de teclado `[` e `]` para página anterior/próxima.
- **Suggested command**: `/impeccable polish`

#### 3. [P2] What: Estado vazio da tabela (`0` avaliações) não oferece botão de recuperação local
- **Why it matters**: Quando uma combinação de filtros resulta em `0` avaliações, [`renderReviews()`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L1138-L1155) exibe apenas o texto estático `"Nenhuma avaliação com esses filtros."` dentro de `.empty-cell`. O usuário que está olhando para a tabela no final da página precisa rolar de volta ao topo ou procurar o botão na barra lateral para sair do estado vazio.
- **Fix**: Em [`renderReviews()`](file:///c:/Projects/game-review-dashboard/frontend/src/scripts/dashboard.ts#L1140-L1148), renderizar dentro de `.empty-cell` a mensagem acompanhada de um botão `<button type="button" class="btn btn-secondary">Limpar filtros</button>` que aciona `resetFilters()` imediatamente.
- **Suggested command**: `/impeccable polish`

#### 4. [P3] What: Inconsistência no anel de foco de `.field-control`, flexão `Todas`/`Todos` nos controles segmentados e ausência de badge `<kbd>/</kbd>`
- **Why it matters**:
  1. Todos os controles interativos usam `outline: 2px solid var(--accent)` em `:focus-visible` ([`global.css#L82-L85`](file:///c:/Projects/game-review-dashboard/frontend/src/styles/global.css#L82-L85)), exceto `.field-control:focus-visible` ([`global.css#L634-L637`](file:///c:/Projects/game-review-dashboard/frontend/src/styles/global.css#L634-L637)), que usa `box-shadow: inset 0 0 0 1px var(--ink)`.
  2. Os controles segmentados usam `"Todas"` em *Recomendação* e *Compra na Steam*, mas `"Todos"` em *Recebido de graça* e *Acesso antecipado* ([`index.astro#L184-L250`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro#L184-L250)).
  3. O atalho `/` para buscar jogos está implementado, mas invisível para usuários videntes.
- **Fix**: Unificar `.field-control:focus-visible` com `var(--accent)`, padronizar os 4 controles segmentados para `"Todas"` e exibir um badge discreto `<kbd class="shortcut-hint" aria-hidden="true">/</kbd>` no rótulo de *Jogo*.
- **Suggested command**: `/impeccable polish`

### Persona Red Flags

- **Alex (Impatient Power User)**:
  - Pressiona `/` para focar `#filter-app`, digita `" Counter"` ou aperta `ArrowDown` até *Counter-Strike* e tecla `Tab`: a seleção é perdida porque `finishEditing()` ignora a opção ativa (`dashboard.ts#L296-L312`).
  - Não descobre visualmente o atalho `/` até inspecionar o DOM, pois não há `<kbd>/</kbd>` junto ao campo `#filter-app`.
- **Jordan (Confused First-Timer)**:
  - Ao combinar filtros incompatíveis que zeram a tabela (`0 de 0`), encontra apenas o texto `"Nenhuma avaliação com esses filtros."` em `#reviews-body` (`dashboard.ts#L1145`) sem um botão imediato para limpar o recorte ali mesmo.
- **Sam (Accessibility-Dependent User)**:
  - Ao percorrer os filtros com `Tab`, nota que o anel de foco muda de `2px solid var(--accent)` externo nos botões para `1px inset var(--ink)` nos 3 campos `.field-control` (`global.css#L634-L637`).
- **Helena (Data Journalist / Game Analyst)**:
  - Ativa o preset *"Economia da insatisfação"* para ler as críticas negativas mais votadas da base, mas percebe que a tabela de avaliações não permite ordenar a coluna *Votos úteis* (`index.astro#L369`) nem *Horas* (`index.astro#L368`).

### Minor Observations

- **Padronização gramatical nos segmented controls**: Uniformizar `"Todos"` para `"Todas"` em *Recebido de graça* ([`index.astro#L225`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro#L225)) e *Acesso antecipado* ([`index.astro#L239`](file:///c:/Projects/game-review-dashboard/frontend/src/pages/index.astro#L239)).
- **Fallback de idiomas não mapeados**: Em [`format.ts#L74-L77`](file:///c:/Projects/game-review-dashboard/frontend/src/lib/format.ts#L74-L77), capitalizar a primeira letra caso algum código de idioma não conste no dicionário `LANGUAGE_NAMES`.
- **Dica visual de atalho de teclado**: Adicionar um `<kbd>` sutil ao lado do label `Jogo` na sidebar para sinalizar o atalho `/`.

### Questions to Consider

- *"E se o cabeçalho da tabela de avaliações permitisse ordenar diretamente por 'Votos úteis' e 'Horas', permitindo comprovar em 1 clique as resenhas que sustentam a tese da Economia da Insatisfação?"*
- *"E se pressionar `Tab` com o combobox aberto confirmasse imediatamente a opção destacada pelas setas ou pela busca parcial, tornando o fluxo por teclado instantâneo?"*
- *"E se o estado vazio da tabela oferecesse um botão 'Limpar filtros' inline para recuperar a exploração sem precisar voltar à barra lateral?"*
