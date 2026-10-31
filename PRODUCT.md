# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Recrutadores técnicos, engenheiros de dados/software, lideranças técnicas e pares avaliando um estudo de caso de portfólio em engenharia e análise de dados. Esses usuários abrem a aplicação para inspecionar tanto a qualidade da implementação full-stack quanto os achados empíricos extraídos de 1.000.000 de avaliações da Steam sem depender da execução manual do notebook Jupyter.

## Product Purpose

Disponibilizar um painel operacional de filtragem cruzada sobre 1.000.000 de avaliações da Steam (março de 2013 a janeiro de 2021, cobrindo 59 jogos e 912.553 autores únicos), permitindo explorar indicadores agregados, séries temporais, distribuição por tempo de jogo, rankings por título/idioma e trechos reais de avaliações. O sucesso do produto consiste em demonstrar rigor analítico, integridade no saneamento dos dados e fluidez na exploração interativa de grandes volumes.

## Positioning

Diferente de um painel demonstrativo com dados sintéticos ou de um relatório estático em notebook, o produto combina uma pipeline de saneamento documentada (auditoria relacional 1:1 das quatro partições CSV do Kaggle, correção de underflow `uint32` em `votes_funny`, truncamento de spam copypasta e reconciliação de telemetria temporal) com uma interface web de consulta rápida sobre a base real higienizada em SQLite via FastAPI.

## Operating Context

- O projeto nasce de um experimento documentado em `README.md` e `analysis.ipynb`, onde o dataset bruto de 4 partições CSV (`review_info.csv`, `game_info.csv`, `author_info.csv`, `purchase_info.csv`) foi auditado e consolidado.
- O painel web opera em conjunto com a API local em FastAPI (`http://127.0.0.1:8000`), consumida pelo frontend em Astro (`http://127.0.0.1:4321`) via proxy `/api`.
- O fluxo principal de uso consiste em combinar até sete dimensões de recorte na barra lateral (`app_id`, `language`, `recommended`, `steam_purchase`, `received_for_free`, `early_access` e `playtime_bucket`) e observar a atualização sincronizada dos 4 cartões de indicadores, dos 2 gráficos ECharts, dos 2 rankings ordenados e da tabela paginada de trechos de avaliações.

## Capabilities and Constraints

- **Stack confirmada:**
  - Frontend: Astro, TypeScript, Tailwind CSS, Apache ECharts, Nanostores e Lucide (`frontend/`).
  - Backend: Python (`>=3.14`), FastAPI, Pydantic, SQLAlchemy e SQLite em prototipação (`backend/`), com evolução prevista para Supabase ou PostgreSQL em produção.
- **Idioma da interface:** Português brasileiro (`pt-BR`), com formatação numérica tabular e datas localizadas.
- **Escopo funcional:** Painel operacional de filtragem cruzada com quatro KPIs (`Avaliações`, `Recomendação`, `Jogos`, `Autores`), série mensal de volume (`Avaliações por mês`), taxa de recomendação por faixa de horas jogadas na avaliação (`<1h`, `1–2h`, `2–5h`, `5–10h`, `10–25h`, `25–50h`, `50–100h`, `100–500h`, `500h+`), rankings de volume por jogo e aprovação por idioma, e listagem paginada de avaliações (20 por página).
- **Saneamento e regras de dados preservadas:**
  - Correção de underflow `uint32` em `votes_funny` (valores $\ge 4.294.967.292$ convertidos para `0`, máximo real de `8.983`).
  - Truncamento de textos extremos de copypasta (limite prático de exibição/análise frente a registros de até 9,6 milhões de caracteres).
  - Tratamento de `1.294` textos nulos e `1.248` registros sem `playtime_at_review`.
- **Restrição de rede local (workaround ativo):** O antivírus Kaspersky na máquina de desenvolvimento intercepta requisições para `/api/metrics` com status `499`; por isso o backend expõe `/api/summary` como alias oficial consumido pelo frontend, mantendo `/api/metrics` por compatibilidade.

## Brand Commitments

- Nome exibido na aplicação: **Reviews da Steam** (com subtítulo de recorte temporal *Março de 2013 a janeiro de 2021*).
- Voz e postura: direta, técnica, concisa e ancorada nos dados, sem jargões promocionais ou alegações inventadas.

## Evidence on Hand

- Base consolidada no banco SQLite (`backend/data/reviews.db`) derivada dos 4 arquivos CSV originais em `data/` ([Game Reviews Dataset no Kaggle](https://www.kaggle.com/datasets/sridharstreaks/game-reviews-dataset)):
  - `1.000.000` de avaliações, `59` jogos, `912.553` autores distintos, taxa global de recomendação de `82,97%`.
  - Cinco títulos concentram `54,65%` das avaliações: *Arma 3*, *The Elder Scrolls V: Skyrim Special Edition*, *For Honor*, *Darkest Dungeon* e *NieR:Automata*.
  - Achados analíticos validados em `analysis.ipynb` e `README.md`: inflexão na janela de reembolso de 2 horas da Valve (`49,6%` de aprovação em `<1h` e `59,9%` em `1–2h`, saltando para `77,4%` em `2–5h` e `93,3%` em `500h+`), assimetria de engajamento nas reviews negativas ("Economia da Insatisfação": `2,8x` mais votos úteis e dobro da mediana de caracteres), queda de `14,0 p.p.` no Acesso Antecipado (`69,8%` vs. `83,8%`) e picos sazonais nas promoções da Steam.
- Artefatos visuais do estudo em `assets/overview.gif` e `assets/overview.mp4`.
- Ausências que não devem ser fabricadas: não há autenticação de usuários, submissão de novas reviews, integração em tempo real com a API da Valve/Steam, nem depoimentos de clientes ou preços comerciais.

## Product Principles

1. **Fidelidade empírica acima de ornamento:** Todo número, faixa, rótulo e resumo exibido na interface deve refletir exatamente o recorte filtrado na base higienizada, sem arredondamentos enganosos ou dados fictícios.
2. **Resposta imediata ao recorte cruzado:** Qualquer combinação dos sete filtros deve atualizar indicadores, gráficos, rankings e tabela de forma coesa, mantendo claro quais filtros estão ativos e permitindo limpá-los em uma ação.
3. **Leitura escaneável para inspeção técnica:** A hierarquia privilegia comparação rápida entre volume, taxa de aprovação e tempo de jogo, permitindo ir do agregado macro de 1 milhão de registros até o trecho individual da avaliação sem atrito.
4. **Transparência sobre limites do recorte:** Estados vazios, erros de carregamento e recortes sem dados em determinadas faixas ou meses devem ser informados de maneira explícita e sóbria.

