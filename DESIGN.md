---
name: Reviews da Steam
description: Painel de filtragem cruzada sobre 1.000.000 de avaliações da Steam, com superfícies tonais, pouca sombra e verde reservado a estado ativo, dado positivo e à assinatura da Recomendação.
colors:
  paper: "#f0f0ed"
  surface: "#ffffff"
  sidebar: "#f7f7f5"
  raised: "#f1f1ee"
  well: "#e8e8e4"
  well-hover: "#e0e0dc"
  field: "#ffffff"
  field-hover: "#f6f6f3"
  line: "#e3e3df"
  ink: "#1c1915"
  secondary: "#5c564e"
  muted: "#665f57"
  accent: "#1f4e46"
  negative: "#9d341f"
typography:
  body:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
    letterSpacing: "0"
  title:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "0"
  meta:
    fontFamily: "IBM Plex Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.01em"
  figure:
    fontFamily: "IBM Plex Mono, ui-monospace, monospace"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: "1"
    letterSpacing: "0"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "20px"
  field-control:
    backgroundColor: "{colors.field}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "44px"
    padding: "0 12px"
  field-control-hover:
    backgroundColor: "{colors.field-hover}"
  filter-chip:
    backgroundColor: "{colors.well}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "32px"
    padding: "4px 10px"
---

# Design System: Reviews da Steam

<!-- Escopo: sistema visual atual do painel (frontend/src/styles e frontend/src/scripts/charts.ts). Valores normativos: frontmatter e frontend/src/styles/global.css. -->

## Overview

**Creative North Star: "A Bancada de Dados"**

O painel é uma bancada de leitura: o chão é papel neutro, os planos são cartões de tom próximo, e os números são impressos em mono para serem comparados. Nada decora. A profundidade vem do tom e de uma sombra curta; a cor só aparece onde ela informa algo: um filtro ativo, um valor acima ou abaixo da base, o foco do teclado e a assinatura da Recomendação.

A hierarquia privilegia comparação rápida entre volume, taxa de aprovação e tempo de jogo. Densidade é média: cards com 20px de padding, tabela compacta, controles com 44px de altura para toque. A voz é a do PRODUCT.md: direta, técnica, ancorada nos dados, sem adjetivos promocionais.

A paleta foi neutralizada de propósito. O chão era creme (`#efeee9`) e passou a ser `#f0f0ed`; o calor do sistema fica na tinta (`--ink`) e no verde, não no fundo.

Referência avaliada e não adotada: um sistema externo "Ledger" (landing escura de fintech, preto, esmeralda, Geist). Só o princípio foi emprestado: controles compartilham o tom do card, com borda fina quando precisam de contorno.

**Key Characteristics:**
- Planos por tom (paper, sidebar, surface, raised), não por contorno.
- Controles interativos com tom de campo e borda `--field-border` nos dois temas.
- Verde (`--accent`) marca estado ativo, dado positivo e a Recomendação. Seleção é neutra (ver One Green Rule).
- Números em IBM Plex Mono com `tabular-nums`.
- Dark mode por `html.dark`; a sombra some no escuro e a borda superior clara faz o papel de luz.

## Colors

Paleta de neutros quentes (tinta e cinza-quente) sobre um chão frio e quase neutro. Cada valor tem par claro e escuro; o token é o mesmo nos dois temas.

### Planos de superfície

Direção dos planos: **paper** é o chão. No claro, **sidebar** é um passo mais claro que o paper e tem divisória de 1px (`--line`) na borda de conteúdo; **surface** (branco) fica acima do chão. No escuro, **sidebar** é mais fundo que o paper, para que os campos (well) sigam rebaixados em relação ao plano.

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `paper` | `#f0f0ed` | `#0f0e0d` | Chão da página |
| `sidebar` | `#f7f7f5` | `#060605` | Plano da barra lateral, da gaveta mobile e da barra superior mobile; divisória `--line` |
| `surface` | `#ffffff` | `#1e1c19` | Cards, tabela, chat, tooltip de gráfico. Popovers usam `--surface-popover` (`#ffffff` / `#22201d`) |
| `raised` | `#f1f1ee` | `#282622` | Hover dentro de card, linha expandida, opção ativa de combobox, cabeçalho do chat |
| `well` | `#e8e8e4` | `#1c1a17` | Chips passivos, atalhos de teclado, bloco de código, área do compositor e chips de sugestão do chat |
| `well-hover` | `#e0e0dc` | `#25231f` | Hover de `well` |

### Controles interativos

Regra: controle interativo usa `--field` e a borda `--field-border`, nos dois temas. No claro, o campo é branco e a borda tem 3,30:1 contra a sidebar. No escuro, o campo é o well e a borda tem 4,01:1 contra a sidebar. A borda nunca é transparente.

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `field` | `#ffffff` (= surface) | `#1c1a17` (= well) | Select e combobox (`.field-control`), gatilho de data, selects de mês e ano do calendário, presets, trilhos segmentados, Limpar (lateral e chip), alternância de tema, achado compacto e Desfazer |
| `field-hover` | `#f6f6f3` | `#25231f` (= well-hover) | Fundo em hover |
| `field-border` | `color-mix(in srgb, var(--ink) 50%, var(--sidebar))` ≈ `#8a8885` | `color-mix(in srgb, var(--ink) 46%, var(--sidebar))` ≈ `#716e69` | Borda em repouso. Claro: 3,30:1 contra sidebar, 3,10:1 contra paper, 3,54:1 contra branco. Escuro: 4,01:1 contra sidebar, 3,82:1 contra paper, 3,36:1 contra surface, 3,22:1 contra popover, 3,44:1 contra o próprio campo (well) |
| `field-border-hover` | `color-mix(in srgb, var(--ink) 64%, var(--sidebar))` ≈ `#6b6966` | `color-mix(in srgb, var(--ink) 62%, var(--sidebar))` ≈ `#96938c` | Borda em hover |

Valores "≈" são o resultado calculado da expressão `color-mix` em sRGB; a expressão é a fonte. Os contrastes são WCAG 2.x sobre as cores sem arredondar (arredondadas para hex de 8 bits, a diferença chega a 0,02).

### Seleção e filtro ativo

Regra: selecionado é neutro. Segmento, preset, achado, linha de ranking e faixa de tempo usam o mesmo par: tom levemente tingido (`--seg-active`) e contorno de 1px (`--seg-ring`). Esse par nunca é verde.

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `seg-active` | `color-mix(in srgb, var(--ink) 8%, var(--surface))` ≈ `#ededec` | `#282622` (= raised) | Fundo do segmento, preset, achado compacto, tile de achado, linha de ranking e faixa de tempo selecionados |
| `seg-ring` | `color-mix(in srgb, var(--ink) 64%, var(--surface))` ≈ `#6e6c69` | `color-mix(in srgb, var(--ink) 38%, var(--well))` ≈ `#6c6963` | Contorno de 1px do selecionado |
| `accent` | `#1f4e46` | `#8fbfa8` | Estado ativo, dado positivo e a Recomendação. Ver One Green Rule |

### Texto e divisórias

| Token | Claro | Escuro | Papel |
|---|---|---|---|
| `ink` | `#1c1915` | `#efe9de` | Texto principal, números, ícones da sidebar, barras de volume do ranking de jogos, taxa na base |
| `secondary` | `#5c564e` | `#aaa398` | Texto de apoio, rótulos de segmento, hover de texto, linha de volume do gráfico mensal |
| `muted` | `#665f57` | `#969086` | Metadados, placeholders, contadores, referências de gráfico |
| `line` | `#e3e3df` | `#34302b` | Divisórias que organizam leitura: linhas da tabela, grade, borda da sidebar, rodapé do popover e do calendário, cabeçalho do chat |
| `negative` | `#9d341f` | `#e7a090` | Valor negativo ("Não" na tabela, taxa abaixo da base), janela de reembolso, erro do chat, ação destrutiva no hover |
| `border-popover` | `color-mix(in srgb, var(--ink) 20%, var(--line))` ≈ `#bbbbb7` | `color-mix(in srgb, var(--ink) 26%, var(--line))` ≈ `#65605a` | Borda de popover e seta de popover |

Contraste calculado (WCAG 2.x, sRGB): `ink` sobre `paper` 15,3:1 (claro) e 16,0:1 (escuro); `muted` sobre `paper` 5,5:1 e 6,1:1; `accent` sobre `paper` 8,2:1 (claro) e sobre `surface` 8,2:1 (escuro).

### Cor nos gráficos

Cor de dado só aparece onde o dado está acima ou abaixo da base. A referência fica em tom neutro.

| Elemento | Cor | Origem |
|---|---|---|
| Barra ou faixa de taxa (tempo de jogo, ranking de idiomas) | acima da base: `--accent`; abaixo: `--negative`; na base: `--ink` | `rateTone` (`charts.ts`); `rank-fill-positive` e `rank-fill-negative` no ranking divergente |
| Menor mês da aprovação (ponto de destaque) | a mesma regra de `rateTone` | `peakTone` (`charts.ts`) |
| Linha da aprovação mensal | um traço só: `--accent`. Não colore ponto a ponto; a comparação fica com a linha de referência | série `month-line` |
| Linha do volume mensal | `--secondary` | série `month-line` em modo volume |
| Referência de base (média geral, "Base") | tracejado em `--muted`; no tempo de jogo, sobre halo de `--surface` | `markLine` |
| Volume de jogos (barras do ranking) | `--ink`, proporcional ao número de avaliações | `.rank-fill` |
| Mês selecionado e janela de zoom do mês | `--accent` (recorte ativo) | `month-selected`, `dataZoom` |
| Eixo central do ranking divergente | `--ink` a 75% (não `--muted`) | `.rank-track-diverging::after` |
| Janela de reembolso (faixas abaixo de 1 h e de 1 a 2 h) | `--negative` a 4% de fundo e filete de 2px a 50% no ranking; área de `--muted` a 8% no gráfico | `.playtime-refund-band`, `markArea` |

### Named Rules

**The Tinted Plane Rule.** Planos se distinguem por tom, não por linha. Um card não ganha borda para se separar do chão; ganha `--shadow-card`. A borda é reservada a controles e a divisórias de leitura.

**The Control Tone Rule.** Controle interativo = tom de campo (`--field`) + borda `--field-border`, nos dois temas. Vale para select, combobox, gatilho de data, selects de mês e ano, presets, trilhos, Limpar, alternância de tema, achado compacto e Desfazer. `--well` fica só em chips passivos, atalhos e chat. Três casos fogem da regra e estão documentados em Components: o botão secundário, os controles fantasma e o chip de sugestão do chat.

**The One Green Rule.** `--accent` marca três coisas, e só elas:

1. **Estado ativo** que o usuário causou ou em que está: filtro aplicado (borda do campo, ícone da linha, texto e contorno do preset ou segmento selecionado), foco do teclado, ordenação ativa, dia selecionado e intervalo no calendário, linha de avaliação expandida, mês selecionado e janela de zoom do gráfico, progresso de carregamento.
2. **Dado positivo**: taxa acima da base nos gráficos e nas barras de ranking, e o "Sim" da coluna Recomendação da tabela.
3. **Uma assinatura de marca**: o número "Recomendação" e a régua abaixo dele (`.stamp-rule`), sempre em accent.

Selecionar um segmento, preset, achado, linha de ranking, faixa de tempo ou chip de faixa é neutro: `--seg-active` com contorno de 1px `--seg-ring`, nunca verde.

**Exceções em vigor.** O código usa accent fora desses três casos. Ficam listadas até serem corrigidas ou aceitas:
- Chat (SteamBot): avatar e ponto de status, selo do modelo, bolha do usuário, botão Enviar quando pronto, links, citações, badges de ferramenta e botão de sugestões.
- Tabela: badge "Acesso antecipado".
- Gráfico mensal: pico do volume (modo volume).
- Ranking de jogos: a barra de volume da linha selecionada fica em accent, ao contrário das outras linhas selecionadas.
- Gráfico de reembolso: rótulo do salto de aprovação, em accent independente do sinal.
- Calendário: hover das células do mês e borda do botão primário do rodapé.

## Typography

**Display Font:** IBM Plex Sans (com `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** IBM Plex Sans (mesma família)
**Label/Mono Font:** IBM Plex Mono (com `ui-monospace, monospace`), para números, rótulos de contagem e datas de intervalo

**Character:** Sans neutra e técnica para texto e rótulos; mono para tudo que é número ou data, com dígitos tabulares para que colunas e KPIs se alinhem sem saltar.

Cinco papéis e dois pesos (400 e 500). Tracking é 0 abaixo de 16px; o meta pode usar 0.01em. Além dos cinco papéis, a interface usa tamanhos de apoio: 11px (calendário, legendas e contadores de gráfico, badges, atalhos), 13px (rótulo de disclosure, título e ação do achado compacto, nome no ranking) e 20px (valor do achado expandido). Há uma exceção de tracking: o rótulo "SteamBot" do botão do chat (14px) usa -0.01em.

### Hierarchy
- **Figure** (500, 28px / 1, mono, `tabular-nums`): KPIs e valores de cartão (`.figure`, `.metric-figure`). Figuras de achado usam mono em 20px (expandido) e 14px (compacto).
- **Title** (500, 16px / 24px): títulos de seção e de card (`.title`, "Achados do estudo").
- **Body** (400, 14px / 20px): texto corrente, células de tabela, rótulos de campo, corpo do chat. Largura de leitura de trechos de avaliação limitada a 72ch (`.excerpt-text`).
- **Meta** (400, 12px / 16px, 0.01em): legendas, cabeçalhos de tabela, contadores, chips e presets. Cor `--muted` ou `--secondary`.
- **Nome** (18px / 24px): papel reservado na escala do `global.css`; nenhum seletor usa 18px hoje. O wordmark usa 20px / 26px (500, -0.01em); no mobile, 16px / 24px.

### Named Rules

**The Figure Rule.** Todo número do painel é mono com `tabular-nums`. Se um valor muda de largura ao filtrar, ele está fora de mono. Exceção: o conector dos achados (→, vs.) fica em sans para caber no tile (`.finding-figure-sep`).

## Layout

Modelo: sidebar fixa à esquerda e conteúdo à direita, em flex. Abaixo de 768px, a sidebar vira gaveta.

- **Desktop (≥768px, `md`):** sidebar `.sidebar-panel` sticky, `height: 100vh`, largura 288px, padding 20px, divisória com `box-shadow: inset -1px 0 0 var(--line)`. Conteúdo em `main` com `flex-1`; a grade (`.stage`) tem `max-width: 1320px`, padding 24px (`px-6 py-6`) e 32px entre seções (`gap-8`).
- **Cabeçalho do conteúdo (`.context-bar`):** no desktop, título, período e link de auditoria à esquerda, alternância de tema no canto superior direito e chips do recorte à direita do título. Abaixo de 768px, o título ocupa a linha inteira; chips (`.active-chips`, `flex: 1 1 0`) e a alternância de tema (centralizada na vertical) dividem a linha seguinte.
- **Mobile (<768px):** a sidebar é um painel fixo de tela cheia com padding 24px, aberto por `.is-open` (transição de 0,3s). A barra superior `.sidebar-mobile-bar` é sticky, com 48px de altura e padding lateral de 16px.
- **Toque e ponteiro grosso:** a regra usa OR, `(max-width: 767px), (pointer: coarse)`. Presets, chips, achados compactos e Desfazer sobem para 36px; segmentos, para 40px; combobox, linhas de ranking, botões pequenos e botões do chat, para 44px. A alternância de tema vai a 44px só com `(pointer: coarse)`.
- **Ponteiro fino, desktop:** presets e achados compactos em 28px; chips e segmentos em 32px; selects do calendário em 28px; alternância de tema em 40px.
- **Chat acoplado (≥1440px):** painel lateral fixo, `100vh`, largura `clamp(360px, 26vw, 420px)`. `#dashboard-main` ganha `margin-right` da mesma largura. Abaixo de 1440px o chat é flutuante: 440px de largura, 640px de altura, 680px quando expandido (a partir de 641px); até 640px ocupa a tela toda.
- **Folga do palco:** `#dashboard-main .stage` tem `padding-bottom` de 92px (`--chat-fab-clearance` = 52 + 24 + 16), para o botão flutuante não cobrir o último cartão.
- **Rodapé sticky da sidebar:** `.filters-footer` tem `bottom: -20px` e `margin: auto -20px -20px`, de modo que o rodapé cobre a faixa de padding do painel e nada rola visível por baixo dele. Mobile: `bottom: -24px` e `margin: auto -24px -24px`.
- **Ritmo:** espaçamentos em 2, 4, 6, 8, 10, 12, 16, 20 e 24px. Padding de card 20px; célula de tabela 12px 16px; seções da página separadas por 32px.

## Elevation & Depth

Sistema híbrido: tom para separar planos e uma sombra curta, só para elementos que sobem (card em hover, popover, chat). No repouso, nada tem sombra além do card.

No escuro a sombra difusa some (`--shadow` vira `none`) e a luz é dada por uma linha superior clara `inset 0 1px 0` com opacidade baixa.

### Shadow Vocabulary
- **Card em repouso** (`--shadow-card`, claro: `0 1px 2px rgba(28, 25, 21, 0.05), 0 4px 16px -4px rgba(28, 25, 21, 0.07)`; escuro: `inset 0 1px 0 rgba(239, 233, 222, 0.045), 0 1px 2px rgba(0, 0, 0, 0.4)`): cards, tabela, seções de gráfico.
- **Elemento clicável em hover** (`--shadow-lift`, claro: `0 1px 2px rgba(28, 25, 21, 0.06), 0 8px 24px -6px rgba(28, 25, 21, 0.1)`; escuro: `inset 0 1px 0 rgba(239, 233, 222, 0.06), 0 8px 24px -6px rgba(0, 0, 0, 0.6)`): `.card` e `.sheet-card` que são botão ou link, tile de achado em hover e gaveta mobile da sidebar.
- **Popover** (`--shadow-popover`, claro: `0 18px 38px -6px rgba(28, 25, 21, 0.16), 0 6px 16px -3px rgba(28, 25, 21, 0.1), 0 0 0 1px rgba(28, 25, 21, 0.06)`; escuro: `0 22px 44px -6px rgba(0, 0, 0, 0.78), 0 8px 20px -4px rgba(0, 0, 0, 0.56), 0 0 0 1px rgba(239, 233, 222, 0.14)`): combobox, calendário, balão do chat, gaveta do chat flutuante e botão flutuante (FAB).
- **Rodapé da sidebar** (sem token): `0 -12px 16px -12px rgba(28, 25, 21, 0.18)` no claro e `rgba(0, 0, 0, 0.6)` no escuro, sobre o `.filters-footer` e a barra de ações mobile.
- **Sombras fixas fora dos tokens:** o lado do chat acoplado (`-12px 0 32px -12px`) e o hover do FAB (`0 10px 24px -4px rgba(28, 25, 21, 0.16)`).
- **`--shadow`** (claro: `0 8px 24px rgba(28, 25, 21, 0.06)`; escuro: `none`): usada só na sombra dos tooltips de gráfico (`tooltipBase` em `charts.ts`). Não usar em componente.

### Named Rules

**The Tone Before Shadow Rule.** Separe planos por tom primeiro. Sombra entra só para elemento que sobe (hover, popover) e nunca como substituto de borda em controle.

## Shapes

Cantos arredondados em uma escala curta. Quanto maior o elemento, maior o raio.

- **4px (`xs`):** atalhos de teclado, badges de revisão e de acesso antecipado, botão de sugestões do chat.
- **6px (`sm`):** segmentos, células de calendário, botões de navegação de data, selects de mês e ano, botões do rodapé do calendário.
- **8px (`md`):** controles (campos, botões, gatilho de data, tema, Limpar, Desfazer), chip de filtro, achado compacto, combobox, linhas de ranking.
- **10px:** popover de data.
- **12px (`lg`):** cards, tabela, tile de achado expandido, compositor do chat.
- **16px (`xl`):** gaveta do chat flutuante. Acoplada ou em tela de até 640px, a gaveta é reta.
- **9999px (`full`):** presets, pílulas de status, botão flutuante do chat (pílula e, compacto, círculo), balão de dica, botão de fechar o balão.
- **2px:** trilhos e barras de ranking.

Bordas: a maioria dos elementos não tem borda. Controles têm 1px `--field-border` nos dois temas. Divisórias usam `--line` e só organizam leitura. Cantos assimétricos aparecem só na marca (`.logo-mark`, `8px 2px 8px 2px`) e nos balões do chat.

## Components

### Buttons
Caráter: sóbrio, com tinta sólida para a ação primária.
- **Shape:** raio 8px (`.btn`); altura 44px. `.btn-small`: 36px no desktop, 44px em toque.
- **Primary:** fundo `--ink`, texto `--paper`; hover em `--secondary`. Desabilitado com `opacity: 0.4`.
- **Secondary (`.btn-secondary`):** fundo `--surface`, borda `--line`; hover em `--raised`. Usado em ações de estado vazio, de erro e de recarregamento. A borda é divisória, não `--field-border`: exceção ao Control Tone Rule.
- **Hover / Focus / Active:** transição de 160ms em `--ease`; `:active` escala para 0.98. Foco: outline de 2px em `--accent`, com offset de 2px.

### Campo e Combobox (`.field-control`, `.combo`)
- **Style:** raio 8px, altura 44px, borda 1px `--field-border`, fundo `--field`, nos dois temas.
- **Hover:** fundo `--field-hover` e borda `--field-border-hover`.
- **Focus:** `outline: 2px solid var(--accent)` com `outline-offset: -2px`, para o anel ficar dentro da borda.
- **Filtro ativo:** a borda vira `--accent` e o ícone da linha também (`.sidebar-row.is-field.is-filtered`). O texto do campo não muda.
- **Combobox:** seta em `.combo-toggle` (44px de largura, gira 180° ao abrir). O valor escolhido (Jogo, Idioma) quebra em até duas linhas num espelho (`.combo-mirror`) que mostra o nome completo fora da digitação. Menu em `--surface-popover`, borda `--border-popover`, `--shadow-popover`, raio 8px. Opções de 36px (44px em toque) com raio 4px; opção ativa ou sob o cursor em `--raised`; zero na fatia atual em `--muted`.

### Gatilho de data e calendário (`.date-trigger`, `.date-popover`, `.date-select`)
- **Style:** par de campo; altura 44px; texto de 12px. Na sidebar, `gap` de 2px e padding de 0 6px, com seta de 10px.
- **Com valor:** texto mono 500 e borda `--accent`. Na sidebar, a seta some e o texto fica centralizado; "01/01/2019" (72px em mono 12px) cabe sem reticências.
- **Sem valor, com o grupo filtrado:** segue o campo (`--field-border`).
- **Aberto:** fundo e borda como hover; seta em `--accent`.
- **Formato:** dd/MM/aaaa, com ano de quatro dígitos (`formatDate`).
- **Popover:** raio 10px, `--shadow-popover`, borda `--border-popover`. Cabeçalho de status em `--sidebar`, com divisória `--line`; dot de status em `--accent`. Células de 26px no mínimo; dia selecionado em `--accent` sólido; intervalo em `--accent` a 12%; prévia tracejada em `--accent` a 36%.
- **Selects de mês e ano (`.date-select`):** 28px, raio 6px, par de campo, texto de 12px em 500. Foco com outline de 2px em `--accent`, offset de -1px.
- **Navegação do mês (`.date-nav-btn`):** 28px, raio 6px, fantasma (ver Controles fantasma).
- **Rodapé:** `.date-footer-btn` é fantasma. `.is-primary` tem fundo `--raised` e borda `--line`; no hover, tinta de accent a 14% e borda `--accent` (exceção).

### Preset e trilho segmentado (`.preset-btn`, `.seg-control`)
- **Preset:** pílula de 28px (36px em toque, com padding de 4px 12px), borda `--field-border`, fundo `--field`, texto `--secondary` em 12px. Hover no tom de campo. Os presets do calendário ficam em grade de 4 colunas.
- **Selecionado (preset e segmento):** fundo `--seg-active`, texto `--ink`, peso 500, contorno de 1px `--seg-ring`. Não é verde.
- **Trilho:** grade de três colunas com fundo `--field` e inset de 1px `--field-border`; segmentos de 32px (40px em toque). Segmento não selecionado em `--secondary`; no hover, `--ink` sobre 4% de tinta.
- **Filtro ativo:** o preset ou segmento selecionado ganha texto e contorno em `--accent`; o trilho ganha anel de 1px em `--accent` (`.sidebar-row.is-field.is-filtered`).

### Chip de filtro e Limpar (`.filter-chip`, `.clear-row`)
- **Chip ativo (`.filter-chip`):** passivo. Raio 8px, fundo `--well`, altura 32px (36px em toque), texto de 12px. Rótulo em `--muted`, valor em `--ink` 500. Remover: ícone mono em `--muted`; hover sobe para `--secondary`. Entrada com `chip-enter` de 160ms.
- **Limpar no chip (`.filter-chip.is-reset`):** é controle, então usa o par de campo: borda `--field-border`, fundo `--field`, texto `--secondary` sublinhado. Hover com `--field-hover` e borda `--field-border-hover`.
- **Limpar na sidebar (`.clear-row`):** 44px, raio 8px, par de campo. Desabilitado: fundo e borda transparentes, texto e ícone em `--muted`, sem hover.

### Card e cartão de métrica (`.card`, `.metric-card`)
- **Corner Style:** raio 12px.
- **Background:** `--surface`. Sem borda.
- **Shadow Strategy:** `--shadow-card` em repouso; `--shadow-lift` se for clicável.
- **Internal Padding:** 20px.
- **Cartão Recomendação:** `.figure.is-accent` em `--accent`, com a régua `.stamp-rule` (24 × 2px) 8px abaixo do número. É o único cartão com `accent: true` (`METRIC_CARDS_CONFIG`).
- **Progresso de carregamento:** barra de 2px em `--accent` no topo do card (`data-fetching='true'`), com 40% da largura e animação de 900ms. Os valores ficam a 78% de opacidade durante a busca.

### Tabela (`.sheet`)
- **Cabeçalho:** 12px, `--muted`, borda inferior `--line`.
- **Linha:** 14px, borda inferior `--line` (a última não tem). Hover em `--raised`.
- **Coluna Recomendação (`.rec-cell`):** "Sim" em `--accent` e "Não" em `--negative`, cada um com ícone de 14px e texto.
- **Foco por teclado:** fundo `--raised` e barras de 2px em `--accent` no topo e na base da linha.
- **Linha expandida:** fundo `--raised`; seta do trecho em `--accent`.
- **Ordenação:** `.th-sort` com seta; ativa em `--accent` 500. Sem ordenação ativa, a seta fica a 55% de opacidade.
- **Colunas numéricas:** mono, `tabular-nums`, alinhadas à direita.

### Achados (`.finding-tile`, `.finding-compact-btn`, `.findings-undo`)
- **Tile expandido:** superfície `--surface`, raio 12px, padding 12px 14px, `--shadow-card`. Hover: fundo `--raised`, `--shadow-lift` e 1px para cima (sem movimento com movimento reduzido). Aplicado (`aria-pressed='true'`): fundo `--seg-active` e contorno interno de 1px `--seg-ring`. Neutro.
- **Compacto (`.finding-compact-btn`):** retângulo de raio 8px, não pílula. Par de campo, 28px (36px em toque), padding 4px 12px. Título em 13px 500; número em mono de 14px em `--secondary`, `--ink` quando aplicado. Aplicado: `--seg-active` e `--seg-ring`.
- **Quando o compacto aparece:** com qualquer filtro ativo ou com o chat acoplado (≥1440px). A nota acima da linha diz "Achados da base completa · não seguem o filtro". Com filtro ativo e nenhum achado aplicado, a nota ganha o aviso visível "clicar em um achado substitui seus filtros".
- **Recorte guardado:** aplicar um achado com nenhum outro ativo guarda o recorte e a ordenação do analista (`findingSnapshot`, em memória: recarregar a página descarta). Trocar de um achado para outro (A → B) mantém o recorte original. Clicar de novo no achado aplicado, ou em "Desfazer · voltar ao seu recorte" (`.findings-undo`, par de campo, 28px, 36px em toque), restaura o recorte guardado. Sem recorte guardado (por exemplo, depois de uma edição manual), desligar limpa os filtros. Uma edição manual que tira o achado do ar descarta o recorte guardado.

### Alternância de tema (`.theme-switch`)
- **Botão:** 40 × 40px, 44px em ponteiro grosso; raio 8px; par de campo. Ícone de 18px: lua no claro, sol no escuro.
- **Área de toque:** em ponteiro fino, um pseudo-elemento dá 44px de área sem alargar o botão.
- **Foco:** outline de 2px em `--accent`, offset de 2px.
- **Lugar:** canto superior direito do cabeçalho do conteúdo, fora da sidebar (ver Layout para o mobile).

### Chat (`.chat-fab`, `.chat-teaser`, `.chat-subtitle`)
- **Botão flutuante:** pílula com avatar de 40px e rótulo "SteamBot" a partir de 768px; atalho Ctrl+K a partir de 1024px. Sombra `--shadow-popover`, a 24px do canto.
- **Compacto:** depois de 120px de rolagem (`data-compact='true'`), vira círculo de 52px só com o avatar. O texto recolhe (largura 0, opacidade 0) e reabre no hover e no foco por teclado.
- **Balão de dica:** não aparece enquanto o botão está compacto. Abaixo de 768px, o rótulo e o balão ficam ocultos.
- **Cabeçalho:** subtítulo com até duas linhas e reticências, largura máxima de 250px.

### Navegação e sidebar (`.sidebar-row`, `.disclosure`)
- **Style:** texto `--ink`, ícone de 20px `--ink`. Linhas de campo alinham o ícone ao topo.
- **Filtro ativo:** ícone em `--accent` e borda do campo em `--accent`.
- **Disclosure:** rótulo de 13px em `--secondary` com contagem em mono; seta gira ao abrir.
- **Mobile:** barra sticky de 48px com marca e botão de 44px.

### Controles fantasma
Botões sem borda em repouso: `.date-nav-btn`, `.date-footer-btn`, `.combo-toggle`, `.excerpt-toggle` e ações do chat (`.chat-action-btn`). Repouso transparente; hover em `--raised` ou `--surface`, com contorno de `--line` quando há contorno. Não recebem o par de campo.

## Do's and Don'ts

### Do:
- **Do** separar planos por tom: paper, sidebar, surface, raised.
- **Do** usar `--field`, `--field-hover`, `--field-border` e `--field-border-hover` em todo controle interativo (select, gatilho de data, selects do calendário, preset, trilho, Limpar, alternância de tema, achado compacto, Desfazer).
- **Do** manter a borda de campo a pelo menos 3:1 contra o plano em que o controle está. Hoje, o pior caso é 3,10:1 contra paper no claro e 3,22:1 contra popover no escuro.
- **Do** usar `--seg-active` e `--seg-ring` para tudo que está selecionado: segmento, preset, achado, linha de ranking e faixa de tempo.
- **Do** reservar `--accent` para estado ativo, dado positivo e a Recomendação.
- **Do** formatar todo número com `--font-mono` e `tabular-nums`.
- **Do** usar 44px de altura nos controles de toque (campo, botão, tema) e 36px no mínimo em toque para presets, chips e achados.
- **Do** deixar `.filters-footer` com `bottom` igual ao negativo do padding do painel, para cobrir a faixa de rolagem.

### Don't:
- **Don't** pintar a página de creme. O chão é `--paper` (`#f0f0ed`); o calor fica na tinta e no verde.
- **Don't** usar `--well` em controle interativo, salvo os chips de sugestão do chat. Ele é para chips passivos, atalhos, código e o compositor do chat.
- **Don't** usar `--accent` em segmento, preset, achado ou linha de ranking selecionados. Selecionado é neutro.
- **Don't** pôr borda em card para separá-lo do chão. Use `--shadow-card`.
- **Don't** usar `--shadow` fora de tooltip de gráfico, nem sombra em repouso dentro de cards.
- **Don't** usar fontes fora de IBM Plex Sans e IBM Plex Mono, nem pesos fora de 400 e 500.
- **Don't** escrever a interface em inglês. A UI é pt-BR com datas e números localizados.
- **Don't** introduzir tracking diferente de 0 abaixo de 16px (exceto `meta`, 0.01em).
