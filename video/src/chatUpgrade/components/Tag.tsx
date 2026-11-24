import React from 'react';
import { COLORS, FONTS, TONE_COLOR, TYPE, Tone, withAlpha } from '../tokens';

interface TagProps {
  tone?: Tone;
  /** 'tag' = retângulo de canto suave (etiqueta); 'pill' = cápsula (stack, chips). */
  shape?: 'tag' | 'pill';
  /** Fundo preenchido com a cor do tom (para destaque forte). */
  solid?: boolean;
  fontSize?: number;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

/** Etiqueta mono com borda e fundo no tom pedido. */
export const Tag: React.FC<TagProps> = ({
  tone = 'neutral',
  shape = 'tag',
  solid = false,
  fontSize = TYPE.label,
  style,
  children,
}) => {
  const color = TONE_COLOR[tone];
  const isNeutral = tone === 'neutral';
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: shape === 'pill' ? '10px 22px' : '12px 20px',
        borderRadius: shape === 'pill' ? 999 : 12,
        border: `1px solid ${isNeutral ? COLORS.borderLight : withAlpha(color, 0.45)}`,
        backgroundColor: solid
          ? color
          : isNeutral
            ? COLORS.raised
            : withAlpha(color, 0.1),
        color: solid ? COLORS.bg : isNeutral ? COLORS.text : color,
        fontFamily: FONTS.mono,
        fontSize,
        fontWeight: 500,
        lineHeight: 1.2,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
