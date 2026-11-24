# Roteiro · SteamBot-9000 v2, versão 100% motion

Variação do [roteiro híbrido](roteiro-chat-v2.md) para comparar as duas linguagens. A tese, o formato (1080 × 1350, 60 fps), a grade da tela e o áudio mínimo são os mesmos.

- Composição: `ChatUpgradeMotion`. Cenas isoladas ficam na pasta `ChatUpgradeMotionScenes` do Studio.
- Saída: `assets/chat-upgrade-motion.mp4` (`npm run render:chat-upgrade-motion`).
- Capa: a mesma do híbrido, `assets/chat-upgrade-capa.png`. A cena da prova é igual nas duas versões; aqui ela cai no frame 2650.
- Duração: 61,2 s (3.672 frames).

## O que muda em relação ao híbrido

A interface do chat é redesenhada em motion (`src/chatUpgrade/mock/`), com letra maior para o celular. Textos, tempos e números saem das execuções gravadas (`mock/data.ts`, lido de `capture/fixtures/`). A tomada real aparece uma vez só, no fim, como prova: o chat dentro do app.

## Linha do tempo

| # | Cena | Tipo | Frames | Tempo |
| :-: | :--- | :--- | :--- | :--- |
| 0 | Gancho | Motion | 0 → 240 | 0:00.0 – 0:04.0 |
| 1 | O teto do v1 | Motion | 234 → 654 | 0:03.9 – 0:10.9 |
| 2 | Motor resiliente | Motion (igual) | 648 → 1038 | 0:10.8 – 0:17.3 |
| 3 | Catálogo inteiro + MCP | Motion (igual) | 1032 → 1422 | 0:17.2 – 0:23.7 |
| 4 | Busca híbrida | Motion | 1416 → 1896 | 0:23.6 – 0:31.6 |
| 5 | O agente trabalhando | Motion | 1890 → 2490 | 0:31.5 – 0:41.5 |
| 6 | Prova | Motion (igual) | 2484 → 2874 | 0:41.4 – 0:47.9 |
| 7 | No app, de verdade | Real | 2868 → 3408 | 0:47.8 – 0:56.8 |
| 8 | Fechamento | Motion (igual) | 3402 → 3672 | 0:56.7 – 1:01.2 |

## Cenas novas

**0 · Gancho.** O painel v2 inteiro: a pergunta da T2, as 4 ferramentas fechando (7 ms, 7 ms, 244 ms, 2 ms), o resumo `4 consultas MCP · 260 ms`, o widget comparativo (90,40% × 85,91%, +4,5 p.p.) e o chip `Foco em NieR: Automata`.

**1 · O teto do v1.** O loader do v1 com as etapas reais e o ticker de SQL. O relógio vai de 0 a 24,4 s a 8×, com o selo `8× acelerado`. Abaixo, uma régua mostra que as etapas trocam em 2,2 s e 5,5 s, por cronômetro, e que o loader fica `parado em 3/3` até a resposta chegar inteira. Depois vêm as 4 etiquetas de limite.

**4 · Busca híbrida.** O diagrama é o do híbrido. No lugar da tomada entra o widget de evidências redesenhado: 144 ms, `40 por palavra · 80 por significado` e os 4 trechos reais (inglês, alemão, chinês, português). Cada trecho tem a fonte: `palavra` (FTS5) ou `significado` (vetor). O trecho em chinês ganha destaque: `pergunta em português, trecho em chinês: achado pelo significado`.

**5 · O agente trabalhando.** É a cena que mais explica.

- Fase A: à direita chegam os eventos AG-UI na ordem real do stream:
  - `RUN_STARTED`;
  - `TOOL_CALL_START` e `TOOL_CALL_RESULT`;
  - `CUSTOM dashboard_actions`;
  - `CUSTOM genui_widget`;
  - `TEXT_MESSAGE_CONTENT ×222`;
  - `RUN_FINISHED`.

  À esquerda, a peça que cada evento cria acende no chat no mesmo instante. O chat rola ancorado no fim, como no app.
- Fase B: o cursor clica no chip, aparece o `Desfazer` (com o title real do botão) e os 4 KPIs mudam:
  - 1.000.000 → 81.110;
  - 82,97% → 85,91%;
  - 59 → 1;
  - 912.553 → 81.110.

**7 · No app, de verdade.** É a única tomada real, toda em 1×:
- um close no painel do chat da T2, com as ferramentas fechando e o widget entrando;
- um plano aberto do app inteiro (proxy `chat-v2-compare-full.mp4`), com cursor e clique da gravação, em 3 passos com anéis sobre a tela:
  1. clique no filtro sugerido;
  2. o painel inteiro filtra para o NieR, com uma aproximação lenta dos KPIs;
  3. `Desfazer`.

## Áudio

A trilha e o volume são os do híbrido. Os efeitos são `tap` quando o widget entra (cena 5), `click` no chip em motion (cena 5) e na tomada real (cena 7), e `whoosh` na entrada do fechamento.

## Números novos desta versão

| Na tela | Fonte |
| :--- | :--- |
| 7 / 7 / 244 / 2 ms, 260 ms no total | `tool_timing` em `capture/fixtures/compare.stream.json` |
| ×222 pedaços de texto | eventos `TEXT_MESSAGE_CONTENT` no mesmo arquivo |
| 144 ms, 40 por palavra, 80 por significado | `tool_timing` e `fts_hits`/`vec_hits` em `search.stream.json` |
| 4 trechos de evidência | `genui_widget` `review_evidence` em `search.stream.json`, horas no formato da UI (`formatHours`) |
| 2,2 s, 5,5 s, ticker de SQL | `ChatIsland.tsx` em `8276d49` (`thinkingStage`, `buildSqlTickerLines`) |
| KPIs antes/depois e linhas de baixo | quadros 1100 e 1180 da tomada T2 |
