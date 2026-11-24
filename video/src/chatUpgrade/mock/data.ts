/**
 * Conteúdo real das execuções gravadas, usado pela versão 100% motion.
 *
 * Fontes:
 *  - v2: capture/fixtures/compare.stream.json e search.stream.json (SSE de
 *    /api/chat/stream gravado com capture/record-stream.ts);
 *  - v1: capture/fixtures/v1-response.json e o ChatIsland.tsx em 8276d49
 *    (etapas do loading em 2,2 s e 5,5 s, ticker de SQL montado a partir dos filtros).
 * Nada aqui é inventado: textos, tempos e números saem desses arquivos.
 */

/** Rótulos que a própria UI usa (TOOL_LABELS em frontend/src/components/react/ChatGenUI.tsx). */
export const TOOL_LABELS = {
  resolve_game: 'Catálogo (59 jogos)',
  compare_slices: 'Comparativo A vs B',
  search_reviews_hybrid: 'Busca Híbrida (FTS5 + Vetor)',
  propose_dashboard_actions: 'Ações do Painel',
} as const;

export interface ToolStepData {
  tool: keyof typeof TOOL_LABELS;
  label: string;
  /** Resumo que a UI mostra ao lado do nome. */
  meta: string;
  /** tool_timing.duration_ms do stream. */
  ms: number;
}

/** Tomada T2 · "Compare Arma 3 com NieR: Automata…" */
export const COMPARE = {
  question: 'Compare Arma 3 com NieR: Automata e sugira um filtro no painel para eu explorar o NieR',
  model: 'nvidia/nemotron-3.5-super-vl:free',
  latencyMs: 19162,
  steps: [
    { tool: 'resolve_game', label: TOOL_LABELS.resolve_game, meta: 'Arma 3', ms: 7 },
    { tool: 'resolve_game', label: TOOL_LABELS.resolve_game, meta: 'NieR: Automata', ms: 7 },
    { tool: 'compare_slices', label: TOOL_LABELS.compare_slices, meta: 'Comparativo pronto', ms: 244 },
    { tool: 'propose_dashboard_actions', label: TOOL_LABELS.propose_dashboard_actions, meta: '1 ação', ms: 2 },
  ] satisfies ToolStepData[],
  /** Soma dos tool_timing: a UI mostra "4 consultas MCP · 260 ms" quando a resposta termina. */
  totalToolMs: 260,
  widget: {
    title: 'Arma 3 vs. NieR: Automata',
    /** approval_delta_pp 4,49 → a UI arredonda para 1 casa. */
    delta: '+4,5 p.p.',
    a: { label: 'Arma 3', pct: 90.4, reviews: 182348, helpful: '2,13' },
    b: { label: 'NieR: Automata', pct: 85.91, reviews: 81110, helpful: '6,49' },
  },
  /** Parágrafo "Delta" da resposta real, sem edição (negrito como no markdown). */
  answerLines: [
    { text: 'Delta:', bold: true },
    { text: ' Arma 3 lidera em aprovação por ', bold: false },
    { text: '+4,49 pontos percentuais', bold: true },
    { text: ' e volume de reviews é ', bold: false },
    { text: '2,25x maior', bold: true },
    { text: ' que o de NieR: Automata.', bold: false },
  ],
  chip: 'Foco em NieR: Automata',
  /** Valor do filtro de jogo depois do clique (app_id 524220). */
  filterValue: 'NieR:Automata™',
  /** KPIs do painel antes e depois do clique, lidos da tomada real (valor e linha de baixo). */
  kpis: [
    { label: 'Avaliações', from: 1_000_000, to: 81_110, format: 'int', fromSub: '100% da base auditada', toSub: '8,11% de 1.000.000' },
    { label: 'Recomendação', from: 82.97, to: 85.91, format: 'pct', fromSub: 'média global da base', toSub: '+2,95 p.p. vs. base (82,97%)' },
    { label: 'Jogos', from: 59, to: 1, format: 'int', fromSub: 'no catálogo analisado', toSub: 'de 59 no catálogo' },
    { label: 'Autores', from: 912_553, to: 81_110, format: 'int', fromSub: 'contas distintas na base', toSub: '8,89% de 912.553 contas' },
  ] as const,
  /** Faixa do topo do painel antes do clique; depois vira o filtro "Jogo: NieR:Automata™". */
  noFilterLabel: 'Base completa · nenhum filtro ativo',
  /** title do botão Desfazer no ChatGenUI. */
  undoTitle: 'Desfazer última alteração de filtro do chat',
  /** Eventos TEXT_MESSAGE_CONTENT no stream gravado. */
  textDeltas: 222,
} as const;

/** Tomada T1 · "O que os jogadores de Arma 3 falam sobre crashes e otimização?" */
export const SEARCH = {
  question: 'O que os jogadores de Arma 3 falam sobre crashes e otimização?',
  /** Consulta que o modelo mandou para search_reviews_hybrid. */
  toolQuery: 'crash otimização desempenho FPS travamento lag',
  toolMs: 144,
  ftsHits: 40,
  vecHits: 80,
  /** Os 4 primeiros itens do widget review_evidence (a UI mostra só 4). */
  evidence: [
    {
      language: 'inglês',
      recommended: true,
      helpful: 849,
      hours: '397,47 h',
      source: 'vector',
      excerpt: 'low settings: 14 fps ultra settings: 15 fps',
      translation: null,
    },
    {
      language: 'alemão',
      recommended: false,
      helpful: 0,
      hours: '110,68 h',
      source: 'fts5',
      excerpt: 'Scheiße fps lags',
      translation: null,
    },
    {
      language: 'chinês',
      recommended: false,
      helpful: 251,
      hours: '3,68 h',
      source: 'vector',
      excerpt: '…但服务器差，优化不足是致命缺陷。…',
      translation: 'servidor ruim; otimização fraca é defeito fatal',
    },
    {
      language: 'português',
      recommended: true,
      helpful: 2,
      hours: '100,27 h',
      source: 'fts5',
      excerpt: '…Único ponto negativo a se ressaltar é a baixa otimização…',
      translation: null,
    },
  ],
} as const;

/** Tomada T0 · chat v1 em 8276d49. */
export const V1 = {
  question: 'Do que reclamam os jogadores com 500 h+ que reprovaram Arma 3?',
  /** Espera real até a resposta, medida pelo contador do próprio loader. */
  waitSeconds: 24.4,
  /** thinkingStage muda por tempo (loadingElapsedMs), não por evento do backend. */
  stages: [
    { from: 0, text: '1/3 Lendo filtros ativos e preparando consulta SQL...' },
    { from: 2.2, text: '2/3 Executando agregações no SQLite sobre 1.000.000 linhas...' },
    { from: 5.5, text: '3/3 Sintetizando análise estatística no modelo...' },
  ],
  /** buildSqlTickerLines(): montado dos filtros da tela, troca a cada 1,3 s. Não é a consulta executada. */
  tickerEveryS: 1.3,
  tickerLines: [
    'SELECT COUNT(*), AVG(recommended) FROM reviews',
    'WHERE 1=1 -- 1.000.000 linhas',
    'GROUP BY language -- ranking por idioma',
    'ORDER BY votes_helpful DESC -- votos úteis',
  ],
  /** Início da resposta real (v1-response.json), sem edição. */
  answerStart:
    'Os veteranos de 500 h+ que reprovam Arma 3 (1.586 reviews negativas nessa faixa) concentram a frustração em poucos pilares recorrentes…',
  maxTokens: 900,
  toolsInV1: 3,
  gamesVisible: 10,
} as const;
