import { Easing } from 'remotion';
import { THEME } from '../overview/theme';

/** Canvas 4:5 para o feed do LinkedIn. */
export const CANVAS = { width: 1080, height: 1350 } as const;

/** Grade da tela (ver video/roteiro-chat-v2.md, seção "Grade da tela"). */
export const LAYOUT = {
  marginX: 72,
  kickerTop: 96,
  headlineTop: 140,
  contentTop: 360,
  contentBottom: 1110,
  whyTop: 1130,
  safeBottom: 1200,
} as const;

export const CONTENT = {
  left: LAYOUT.marginX,
  top: LAYOUT.contentTop,
  width: CANVAS.width - LAYOUT.marginX * 2, // 936
  height: LAYOUT.contentBottom - LAYOUT.contentTop, // 750
} as const;

export const COLORS = {
  ...THEME.colors,
} as const;

export const FONTS = {
  sans: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** Tamanhos mínimos pensados para leitura no celular. Nada abaixo de 24 px. */
export const TYPE = {
  kicker: 26,
  headline: 64,
  body: 36,
  label: 28,
  small: 24,
  why: 32,
  number: 96,
} as const;

export const EASE_OUT = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
export const EASE_IN = Easing.bezier(0.7, 0, 0.84, 0);

/** Converte #RRGGBB em rgba() com a opacidade pedida. */
export function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export type Tone = 'red' | 'amber' | 'emerald' | 'neutral';

export const TONE_COLOR: Record<Tone, string> = {
  red: COLORS.red,
  amber: COLORS.amber,
  emerald: COLORS.emerald,
  neutral: COLORS.textSecondary,
};
