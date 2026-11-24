import { interpolate } from 'remotion';
import { EASE_OUT } from './tokens';

/** Progresso 0→1 entre `start` e `start + duration`, com clamp. */
export function progress(
  frame: number,
  start: number,
  duration: number,
  easing: (t: number) => number = EASE_OUT,
): number {
  return interpolate(frame, [start, start + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/** Entrada padrão: fade + subida curta. Devolve props de estilo prontas. */
export function enterUp(
  frame: number,
  start: number,
  duration = 24,
  distance = 24,
): { opacity: number; translate: string } {
  const p = progress(frame, start, duration);
  return {
    opacity: p,
    translate: `0px ${(1 - p) * distance}px`,
  };
}

/** Número formatado em pt-BR (998533 → "998.533"). */
export function formatInt(value: number): string {
  return Math.round(value).toLocaleString('pt-BR');
}
