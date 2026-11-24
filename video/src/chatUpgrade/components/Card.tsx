import React from 'react';
import { COLORS } from '../tokens';

interface CardProps {
  style?: React.CSSProperties;
  /** Borda na cor pedida (ex.: estado ativo). Padrão: hairline. */
  borderColor?: string;
  children?: React.ReactNode;
}

/** Superfície padrão do vídeo: grafite elevado, hairline e canto de 16 px. */
export const Card: React.FC<CardProps> = ({ style, borderColor, children }) => (
  <div
    style={{
      backgroundColor: COLORS.surface,
      border: `1px solid ${borderColor ?? COLORS.border}`,
      borderRadius: 16,
      boxSizing: 'border-box',
      ...style,
    }}
  >
    {children}
  </div>
);
