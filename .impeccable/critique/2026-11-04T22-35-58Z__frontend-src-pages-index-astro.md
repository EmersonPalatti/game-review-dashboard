---
target: UX de loading do dashboard
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 1
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:dcef3e2a69c5a6897c8b00c5d32913b56edde96b28c3fa0e0aeb9912c8a07b55"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-11-04T22-35-58Z
slug: frontend-src-pages-index-astro
closed: true
---
Method: dual-agent (A: 53948c68-b387-4056-bd44-e8e0f76f3d8e · B: f60697d2-8ccc-4fcd-b04e-1b392df81d7f)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | A barra de 2px e o escurecimento existem no CSS, mas ninguém marca `#dashboard-main` como ocupado; no refetch os números antigos ficam na tela sem sinal. |
| 2 | Match System / Real World | 3 | Vocabulário do estudo (faixas de horas, presets de tese, idiomas, base higienizada) está no lugar certo. |
| 3 | User Control and Freedom | 3 | Limpar filtros, chips removíveis e URL sincronizada devolvem o recorte. |
| 4 | Consistency and Standards | 3 | Cards e tabela seguem o mesmo sistema; o status de carregamento não: a tabela tem texto, KPIs e gráficos ficam mudos. |
| 5 | Error Prevention | 3 | Combos, três vias e presets evitam recorte inválido. |
| 6 | Recognition Rather Than Recall | 3 | Chips e “N filtros ativos” mantêm o recorte visível. |
| 7 | Flexibility and Efficiency | 3 | `/` foca o jogo, ranks viram filtro, URL é compartilhável. Falta o atalho visual de “ainda estou buscando”. |
| 8 | Aesthetic and Minimalist Design | 3 | Hierarquia escaneável; a barra de 2px, quando ligada, não compete com os números. |
| 9 | Error Recovery | 3 | Cada ilha tem alerta e “Tentar de novo”. |
| 10 | Help and Documentation | 2 | Microcopy de linha e de preset ajuda; não há ajuda contextual no momento em que o recorte ainda não assentou. |
| **Total** | | **28/40** | **Good** |

#### Design Specificity Verdict

**LLM assessment.** O painel é deste estudo, não um dashboard genérico. Presets (“Janela < 1 h”, “Economia da insatisfação”), subtítulos em % da base de 1.000.000 e p.p. vs. baseline, faixas de tempo de jogo e o chip “Base higienizada” só fazem sentido aqui. A feature de loading do commit `2c14a09` também é deste painel: uma linha de 2px na cor de acento, varrendo o topo dos cards de gráfico e da tabela, com os números a 78% de opacidade e o corpo da tabela a 45%, sem spinner central e sem overlay. Isso combina com uma ferramenta de inspeção. O que quebrou na migração para React e TanStack Query foi o fio, não a linguagem visual.

**Deterministic scan.** `impeccable detect` em `frontend/src/pages`, `frontend/src/components` e `frontend/src/layouts` saiu com código 0 e JSON `[]`. Zero achados, zero regras. O detector não vê o contrato morto: o CSS em `global.css` (linhas 498–535 e 982–984) só reage a `#dashboard-main[aria-busy='true']`, e esse atributo não é mais definido. `ReviewsIsland` marca `aria-busy` no `tbody#reviews-body`, que não casa com o seletor. Anti-padrão estático nenhum; falha de comportamento, sim. Nenhum falso positivo para descartar.

**Visual overlays.** A injeção de `detect.js` na aba **[Human]** funcionou (porta 8400, depois `live-server stop --keep-inject`). O console registrou `[impeccable] No anti-patterns found.` Não há realce na página: o detector não tem o que pintar. A troca para Inglês atualizou URL, chip e combobox sem barra, skeleton ou spinner.

#### Overall Impression

A velocidade nova está certa, e a barra antiga ainda é a melhor peça para dizer que a requisição corre. Ela deve voltar ligada ao fetching agregado, com um atraso curto de aparição que o commit anterior não tinha. Skeleton no lugar dela apagaria a sensação de resposta imediata que o `keepPreviousData` acabou de comprar.

Carga cognitiva moderada: 3 falhas no checklist de 8 (foco único, uma decisão por vez, escolhas mínimas). Os pontos com mais de 4 opções são o combo de tempo de jogo (~10 faixas), o combo de jogo (59 títulos) e a barra lateral com sete dimensões mais presets. Isso é o produto de cross-filter, não o buraco do loading. O buraco é extraneous: o usuário precisa adivinhar se o número na tela já é do clique que acabou de fazer.

#### What's Working

- O cross-filter ficou estável. `keepPreviousData` segura KPIs, gráficos e linhas no lugar enquanto as queries paralelas resolvem. Trocar de recorte não zera a tela.
- Os KPIs contam a tese, não só o número: “% de 1.000.000”, pontos percentuais contra a base, animação curta quando o valor novo chega.
- A tabela já sabe falar no primeiro carregamento (“Carregando avaliações…”) e no infinite scroll (“carregando mais…”), com virtualização, ordenação e estado vazio que oferece limpar os filtros.

#### Priority Issues

- **[P0] A barra de carregamento está no CSS e não liga.** Em `2c14a09`, `setLoading()` fazia `main.setAttribute('aria-busy', 'true')` no início de `load()` e tirava o atributo no `finally`, cobrindo métricas, reviews e gráficos no mesmo `Promise.all`. O CSS respondia com a varredura `chart-progress` (900 ms) nos cards de gráfico e em `.sheet-card`, opacidade 0,78 nos números e gráficos, opacidade 0,45 e `pointer-events: none` em `#reviews-body`, `cursor: wait` nos cabeçalhos de ordenação. No HEAD, `dashboard.ts` não mexe mais em `aria-busy`. Com rede lenta, a revisão viu `aria-busy` só no `tbody` e os pseudo-elementos da barra com opacidade 0. Quem filtra não recebe confirmação de que o clique entrou em processamento.
  - **Why it matters:** O público deste painel confere se o número mudou por causa do filtro. Sem sinal, uma resposta rápida parece “não aconteceu nada” e uma resposta lenta parece dado confirmado.
  - **Fix:** Uma ponte no `QueryRoot` (ou equivalente) com `useIsFetching` nas chaves `metrics`, `charts` e `reviews`. Ela marca `#dashboard-main` com `aria-busy="true"` só depois de ~160–200 ms ainda em flight, e limpa no settle. Reusa o CSS existente. O atraso é decisão nova: no commit anterior o atributo ligava no instante do `load()`. Com queries locais rápidas, ligar na hora faria a barra piscar em todo clique e brigaria com a performance que você sentiu.
  - **Suggested command:** `/impeccable animate`

- **[P1] Durante o refetch, o recorte anterior parece definitivo.** `MetricsIsland` lê `isPlaceholderData` só para gravar o baseline, e não pinta estado stale. `ChartsIsland` nem observa `isFetching`. O efeito do subtítulo reage a `currentFilters` enquanto `data` ainda pode ser o placeholder: a tese nova (“Janela < 1 h”) pode aparecer ao lado da contagem velha. A opacidade dos `.figure` só cai se o `main` estiver `aria-busy` — o mesmo fio do P0.
  - **Why it matters:** Um recrutador técnico lê 82,97% como fato do recorte atual. Se esse número ainda é da base inteira, o painel mente por omissão no exato momento em que o case pede rigor.
  - **Fix:** O dimming já escrito em `#dashboard-main[aria-busy='true'] .figure` (e nos gráficos e rankings) resolve a maior parte, desde que o P0 ligue o atributo. Completar com “Atualizando…” em `#context-subtitle` ou num status com `aria-live="polite"` enquanto `isPlaceholderData` ou `isFetching` for verdadeiro.
  - **Suggested command:** `/impeccable clarify`

- **[P2] A tabela e o resto do painel não contam a mesma história.** `#reviews-status` diz “Carregando avaliações…” só quando `isPending && items.length === 0`. No refetch com linhas antigas, o texto segue “N de M carregadas”. `isFetching` no `tbody` não aciona estilo nenhum, porque o CSS exige o ancestral `#dashboard-main[aria-busy='true']`. Sob latência, a tabela pode continuar em “Carregando avaliações…” depois que os KPIs já trocaram.
  - **Why it matters:** Três regiões, três tempos, uma conclusão. O usuário não sabe qual número já é do filtro novo.
  - **Fix:** Incluir “Atualizando…” quando `isFetching && items.length > 0`. A barra global no `main` alinha gráficos e tabela. Skeleton fica reservado ao primeiro paint da ilha, quando ainda não há linha para preservar.
  - **Suggested command:** `/impeccable clarify`

- **[P2] O primeiro carregamento e o refetch usam o mesmo silêncio nos indicadores.** No primeiro `isPending`, os KPIs mostram “—”, e isso funciona. Nos cliques seguintes, esse vazio não volta — e nada ocupa o lugar dele. A animação numérica (~360 ms) confirma a chegada do dado, não a ida da requisição.
  - **Why it matters:** O feedback que sobrou responde “o número mudou”. A pergunta do usuário é “a requisição está sendo processada?”.
  - **Fix:** Tratar os dois momentos com peças diferentes. Primeiro paint: “—” nos KPIs e “Carregando avaliações…” na tabela. Refetch: barra atrasada + dimming + “Atualizando…”. Não cobrir o refetch com skeleton.
  - **Suggested command:** `/impeccable animate`

#### Persona Red Flags

**Alex (power user).** Alterna presets e ranks na velocidade do cache. `#dashboard-main` nunca fica `aria-busy`, então a barra e o dimming não aparecem. Alex lê o KPI ainda placeholder como resultado e segue para o próximo recorte. O atalho `/` foca o jogo; não há sinal equivalente de que o fetch anterior ainda não assentou.

**Sam (teclado e leitor de tela).** O `aria-busy` está no `tbody`, e o anúncio útil do painel (a barra, o dimming, o cursor de espera) depende do `main`. Trocar de filtro não anuncia “buscando o recorte”. Os botões de ordenação substituem linhas sem live region. O banner `#load-error` (“Não foi possível carregar os dados.”) continua no DOM com `hidden`; o snapshot de acessibilidade ainda listou o texto. Vale confirmar no leitor de tela real se o `hidden` já o exclui.

**Riley (dados stale e bordas).** Clique em “Janela < 1 h”: o subtítulo pode citar a tese enquanto os KPIs ainda mostram 1.000.000 e 82,97%. A tabela mantém as linhas do filtro anterior com o status “N de M carregadas”. Em rede lenta, “Carregando avaliações…” com corpo vazio parece travamento, porque não há barra em nenhum card.

#### Minor Observations

- Os quatro cards de KPI nunca tiveram a linha de progresso. O legado também limitava a varredura aos gráficos e à tabela. Estender a barra aos KPIs duplicaria o dimming dos `.figure`.
- `prefers-reduced-motion` já desliga a animação e deixa a linha em 100% da largura (`global.css`, por volta da linha 1281). Ao religar o busy, esse cuidado continua valendo.
- `document.documentElement.dataset.fetching`, do fluxo antigo, também saiu. Não tinha estilo próprio.
- A avaliação A atribuiu um atraso de 180 ms ao commit `2c14a09`. O código desse commit liga `aria-busy` dentro de `setLoading()`, chamado no início de `load()`, e só remove no `finally`. Os 180 ms são `--menu` no CSS, outro token. O atraso de exibição proposto aqui é proteção nova contra piscar, não restauração literal.

#### Questions to Consider

- Se o painel existe para a leitura não mentir, quanto tempo um número do recorte anterior pode ficar na tela com cara de número final?
- A linha de 2px nos gráficos e na tabela basta, ou o `#context-bar` precisa da frase “Atualizando recorte…” para amarrar o subtítulo ao fetch?
- A tabela em `client:visible` atrasa de propósito o primeiro paint. Para quem abre um link já filtrado, isso lê como performance ou como tela pela metade?
