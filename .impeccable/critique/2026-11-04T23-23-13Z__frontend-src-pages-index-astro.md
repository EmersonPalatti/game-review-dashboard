---
target: fluidez do loading global
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
target_identity: "file:C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
target_fingerprint: "sha256:59c45bed2ebf1e8bdf80251cb2573b981be4211d75afd2dd27ec1a20a15645eb"
target_path: "C:\\Projects\\game-review-dashboard\\frontend\\src\\pages\\index.astro"
timestamp: 2026-11-04T23-23-13Z
slug: frontend-src-pages-index-astro
closed: true
---
Method: dual-agent (A: f92a7fe7-7450-4d7d-9f25-752ad95ae605 · B: 3fc52ef8-092f-4ac3-961e-d3b88b4d6982)

#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Há feedback, mas um único `aria-busy` no painel escurece regiões que já receberam o recorte novo. |
| 2 | Match System / Real World | 3 | Presets, faixas de horas e teses falam a língua do estudo. |
| 3 | User Control and Freedom | 3 | Limpar filtros e chips devolvem o recorte. A tabela inteira fica sem clique enquanto qualquer região busca. |
| 4 | Consistency and Standards | 2 | O texto é por região (“Atualizando…”). O escurecimento e a barra são do painel inteiro. |
| 5 | Error Prevention | 3 | Combos, três vias e presets evitam recorte inválido. |
| 6 | Recognition Rather Than Recall | 3 | Chips e “N filtros ativos” mantêm o recorte visível. |
| 7 | Flexibility and Efficiency | 3 | Presets, ranks e virtualização seguem rápidos. O gate visual pune quem filtra em sequência. |
| 8 | Aesthetic and Minimalist Design | 3 | A linha de 2 px é sóbria. Ligada nos quatro gráficos e na tabela ao mesmo tempo, vira ruído. |
| 9 | Error Recovery | 3 | Cada ilha tem alerta e “Tentar de novo”. |
| 10 | Help and Documentation | 2 | A copy distingue primeira carga, refetch e “carregando mais”. Não explica um recorte que chegou pela metade. |
| **Total** | | **27/40** | **Acceptable** |

#### Design Specificity Verdict

**LLM assessment.** O painel continua deste estudo: presets de tese, faixas de reembolso, base de 1.000.000. A migração para ilhas e TanStack Query entrega o recorte em paralelo, com o número anterior na tela. O loading restaurado trata esse painel como se as três respostas ainda saíssem juntas. Quando indicadores e gráficos já mostram o corte novo e a tabela ainda busca, o usuário vê o número certo com cara de número que não deve ser lido. Isso é o oposto da fluidez que a migração tinha acabado de comprar.

**Deterministic scan.** `impeccable detect` em `frontend/src/pages`, `frontend/src/components` e `frontend/src/layouts` saiu com código 0 e JSON `[]`. Zero achados. O detector não vê um `aria-busy` calculado em runtime. Não há falso positivo para descartar.

**Visual overlays.** A injeção de `detect.js` na aba **[Human]** funcionou (porta 8400, `live-server stop --keep-inject`). O console registrou `[impeccable] No anti-patterns found.` Não há realce na página. Num clique rápido em “Janela < 1 h”, a barra e o “Atualizando…” não passaram dos 180 ms. A revisão de desenho, com amostragem mais apertada, viu os números novos já na tela e a opacidade ainda em 0,78 enquanto a tabela seguia em 0,45. As duas leituras combinam: em rede local rápida o portão nem abre; quando a tabela demora, o portão segura o que já chegou.

#### Overall Impression

Dá para melhorar, e o alvo é estreito. Soltar o escurecimento e a barra de cada região no instante em que a resposta dela chega. A linha de 2 px e o “Atualizando…” ficam só no bloco que ainda busca. A tabela, em geral a mais lenta, continua avisando por conta própria. Indicadores e gráficos clareiam assim que o recorte deles está na tela.

Carga cognitiva deste gesto: 4 falhas. O loading não mapeia a região que ainda busca. O número legível não parece confiável. Dim, barra e texto repetem o mesmo alerta. A ordenação da tabela herda `cursor: wait` do painel inteiro. A densidade da barra lateral, já medida antes, fica de fora deste veredito.

#### What's Working

- As três consultas continuam paralelas, com `keepPreviousData`. Trocar de filtro não zera a tela.
- O atraso de 180 ms evita piscar em resposta local rápida. O nanostore entre ilhas é o canal certo: cada ilha tem o próprio cache do TanStack Query.
- A tabela ainda separa três frases: “Carregando avaliações…”, “Atualizando…” e “carregando mais…”. A virtualização e as janelas de 100 seguem no lugar.

#### Priority Issues

- **[P0] Número novo com cara de número velho.** `#dashboard-main[aria-busy='true']` baixa a opacidade de `.figure`, dos gráficos e dos ranks para 0,78, e a da tabela para 0,45, enquanto qualquer uma das três regiões busca. Os indicadores já podem mostrar 56.950 e a tese da primeira hora com o tratamento de “ainda não confie”, porque a tabela não assentou.
  - **Why it matters:** Quem inspeciona este case decide em segundos se o número bate com o filtro. Escurecer um KPI que já é do recorte novo parece cache errado, não loading.
  - **Fix:** Cada região carrega o próprio estado atrasado. Indicadores, gráficos e tabela ganham o escurecimento e a linha só enquanto a consulta delas dura. O `aria-busy` sai do `main` e vai para a seção que ainda busca.
  - **Suggested command:** `/impeccable animate`

- **[P1] A região dos gráficos espera também a consulta de indicadores.** `ChartsIsland` publica `metricsFetching || chartsFetching` na chave `charts`. A série pode já estar desenhada e a barra dos quatro cards continua, porque a consulta duplicada de métricas nessa ilha ainda não terminou.
  - **Why it matters:** Alonga de propósito a janela em que o gráfico pronto parece incompleto.
  - **Fix:** A chave `charts` observa só `chartsFetching`. Indicadores já têm a chave `metrics`.
  - **Suggested command:** `/impeccable animate`

- **[P1] Um `aria-busy` no painel anuncia a página inteira.** O leitor de tela ouve o `main` ocupado quando os indicadores já estabilizaram. O `aria-busy` do `tbody` não acompanha o que o olho vê.
  - **Why it matters:** O status atrasa a realidade. Sam não sabe qual bloco ainda sincroniza.
  - **Fix:** `aria-busy` na seção que busca, com o `aria-live` que o subtítulo e o status da tabela já têm.
  - **Suggested command:** `/impeccable clarify`

- **[P2] A linha de 2 px e o `cursor: wait` acendem em bloco.** Os quatro gráficos e a ficha da tabela pulsam juntos, e os cabeçalhos de ordenação esperam, mesmo quando só a tabela falta.
  - **Why it matters:** Quatro jobs visuais para um endpoint lento. A fluidez que o usuário sentiu antes era cada bloco clareando na sua hora.
  - **Fix:** A varredura fica no card da região pendente. O `cursor: wait` fica nos sorts só enquanto a tabela busca.
  - **Suggested command:** `/impeccable animate`

#### Persona Red Flags

**Alex (power user).** Troca preset e rank em sequência. Os KPIs já são o recorte novo e continuam “em espera” até a tabela. A latência que ele sente depois da resposta HTTP é o portão visual, não a rede.

**Sam (teclado e leitor de tela).** `main` ocupado enquanto os números já podem ser lidos. Não há anúncio de qual bloco ainda sincroniza.

**Riley (número fresco com cara de stale).** 56.950 a 78% de opacidade porque as avaliações ainda carregam. Lê como bug de cache.

#### Minor Observations

- O bloqueio de clique na tabela (`pointer-events: none` e opacidade 0,45) faz sentido no corpo da tabela. No KPI, não.
- `#load-error` segue no DOM, oculto e `aria-hidden`. O snapshot de acessibilidade ainda lista o texto.
- Em localhost, respostas abaixo de 180 ms não mostram barra nem “Atualizando…”. Esse silêncio está certo. O peso aparece quando a tabela passa desse limiar e segura o resto.

#### Questions to Consider

- Se o KPI e o gráfico já são o recorte, qual risco justifica a tabela vetar a leitura dos dois?
- O escurecimento de 0,78 diz “ainda buscando” ou “não confie neste número” para quem decide em três segundos?
- O nanostore já sabe qual região busca. Por que o contrato visual ainda é um booleano só no `main`?
