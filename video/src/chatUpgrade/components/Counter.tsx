import React from 'react';
import { useCurrentFrame } from 'remotion';
import { formatInt, progress } from '../anim';
import { EASE_IN_OUT } from '../tokens';

interface CounterProps {
  from: number;
  to: number;
  /** Frame (local da cena) em que a contagem começa. */
  start: number;
  /** Duração da contagem em frames. */
  duration: number;
  prefix?: string;
  suffix?: string;
  style?: React.CSSProperties;
}

/** Número que conta de `from` até `to`, formatado em pt-BR e com dígitos tabulares. */
export const Counter: React.FC<CounterProps> = ({
  from,
  to,
  start,
  duration,
  prefix = '',
  suffix = '',
  style,
}) => {
  const frame = useCurrentFrame();
  const p = progress(frame, start, duration, EASE_IN_OUT);
  const value = from + (to - from) * p;
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}
      {formatInt(value)}
      {suffix}
    </span>
  );
};
