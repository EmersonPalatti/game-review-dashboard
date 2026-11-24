import React from 'react';
import { AbsoluteFill } from 'remotion';
import { COLORS } from '../tokens';

/** Fundo grafite com grade fina e moldura hairline a 40 px da borda (fica fora da margem de 72 px). */
export const PortraitBackground: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg, pointerEvents: 'none' }}>
    <AbsoluteFill
      style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.022) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.022) 1px, transparent 1px)
        `,
        backgroundSize: '54px 54px',
        backgroundPosition: '0px 0px',
      }}
    />
    <div
      style={{
        position: 'absolute',
        inset: 40,
        border: '1px solid rgba(242, 240, 235, 0.035)',
      }}
    />
  </AbsoluteFill>
);
