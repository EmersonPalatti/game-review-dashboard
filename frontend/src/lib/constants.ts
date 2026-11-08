import {
  PLAYTIME_LABELS,
  type Filters,
  type PlaytimeBucket,
} from '../stores/filters';

export const PLACEHOLDER = '—';
export const THEME_KEY = 'steam-reviews-theme';
export const THEME_REVEAL_MS = 400;

export const BASELINE_REVIEWS = 1_000_000;
export const BASELINE_RATE = 0.8297;
export const BASELINE_GAMES = 59;
export const BASELINE_AUTHORS = 912_553;
export const BASELINE_PERIOD_SHORT = 'mar/2013 a jan/2021';
export const AUDIT_REPO_URL = 'https://github.com/EmersonPalatti/game-review#readme';

export const REFUND_BUCKETS: readonly PlaytimeBucket[] = ['lt1', 'h1_2'];

const PLAYTIME_ORDER: readonly Exclude<PlaytimeBucket, 'all'>[] = [
  'lt1',
  'h1_2',
  'h2_5',
  'h5_10',
  'h10_25',
  'h25_50',
  'h50_100',
  'h100_500',
  'gte500',
];

export const PLAYTIME_OPTIONS: { value: PlaytimeBucket; label: string }[] = PLAYTIME_ORDER.map(
  (key) => ({
    value: key,
    label: PLAYTIME_LABELS[key],
  }),
);

export type PresetKey = 'refund' | 'early' | 'dissatisfaction';

export type ThesisPreset = {
  key: PresetKey;
  label: string;
  title: string;
  note: string;
  filters: Filters;
};

// Os números exibidos nos achados vêm da API (ver ContextIsland). Títulos e notas
// descrevem o recorte e não afirmam percentuais.
export const THESIS_PRESETS: readonly ThesisPreset[] = [
  {
    key: 'refund',
    label: 'Janela < 1 h',
    title: 'Filtrar avaliações na primeira hora de jogo (< 1 h)',
    note: 'recorte: primeira hora de jogo (< 1 h)',
    filters: {
      appId: null,
      language: null,
      dateFrom: null,
      dateTo: null,
      recommended: 'all',
      steamPurchase: 'all',
      receivedForFree: 'all',
      earlyAccess: 'all',
      playtime: 'lt1',
    },
  },
  {
    key: 'early',
    label: 'Acesso antecipado',
    title: 'Filtrar avaliações em Acesso Antecipado',
    note: 'recorte: jogos em acesso antecipado',
    filters: {
      appId: null,
      language: null,
      dateFrom: null,
      dateTo: null,
      recommended: 'all',
      steamPurchase: 'all',
      receivedForFree: 'all',
      earlyAccess: 'yes',
      playtime: 'all',
    },
  },
  {
    key: 'dissatisfaction',
    label: 'Economia da insatisfação',
    title: 'Filtrar avaliações negativas, ordenadas por votos úteis',
    note: 'recorte: avaliações negativas, ordenadas por votos úteis',
    filters: {
      appId: null,
      language: null,
      dateFrom: null,
      dateTo: null,
      recommended: 'no',
      steamPurchase: 'all',
      receivedForFree: 'all',
      earlyAccess: 'all',
      playtime: 'all',
    },
  },
];

export const PRESETS: Record<PresetKey, Filters> = Object.fromEntries(
  THESIS_PRESETS.map((preset) => [preset.key, preset.filters]),
) as Record<PresetKey, Filters>;

export const PRESET_NOTES: Record<PresetKey, string> = Object.fromEntries(
  THESIS_PRESETS.map((preset) => [preset.key, preset.note]),
) as Record<PresetKey, string>;

export function isPresetActive(current: Filters, preset: string): boolean {
  if (preset !== 'refund' && preset !== 'early' && preset !== 'dissatisfaction') return false;
  const target = PRESETS[preset];
  return (
    current.appId === target.appId &&
    current.language === target.language &&
    current.dateFrom === target.dateFrom &&
    current.dateTo === target.dateTo &&
    current.recommended === target.recommended &&
    current.steamPurchase === target.steamPurchase &&
    current.receivedForFree === target.receivedForFree &&
    current.earlyAccess === target.earlyAccess &&
    current.playtime === target.playtime
  );
}

export function activePresetNote(current: Filters): string | null {
  const keys: PresetKey[] = ['refund', 'early', 'dissatisfaction'];
  for (const key of keys) {
    if (isPresetActive(current, key)) return PRESET_NOTES[key];
  }
  return null;
}

export type MetricCardConfig = {
  id: 'reviews' | 'recommendation' | 'games' | 'authors';
  label: string;
  defaultSub: string;
  accent?: boolean;
};

export const METRIC_CARDS_CONFIG: readonly MetricCardConfig[] = [
  { id: 'reviews', label: 'Avaliações', defaultSub: '100% da base auditada' },
  { id: 'recommendation', label: 'Recomendação', defaultSub: 'média global da base', accent: true },
  { id: 'games', label: 'Jogos', defaultSub: 'de 59 no catálogo' },
  { id: 'authors', label: 'Autores', defaultSub: 'de 912.553 contas' },
];
