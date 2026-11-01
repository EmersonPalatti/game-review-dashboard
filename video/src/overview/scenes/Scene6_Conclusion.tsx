import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

export const Scene6_Conclusion: React.FC = () => {
  const frame = useCurrentFrame();

  // 3 lines staggered entrance (60 FPS)
  const op1 = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y1 = interpolate(frame, [0, 28], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const op2 = interpolate(frame, [24, 52], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y2 = interpolate(frame, [24, 52], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const op3 = interpolate(frame, [48, 76], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y3 = interpolate(frame, [48, 76], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Footer entrance
  const footerOp = interpolate(frame, [72, 104], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'relative',
        width: 1920,
        height: 1080,
        fontFamily: THEME.fonts.sans,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '0 140px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Optical Center Statements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: THEME.colors.textSecondary,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              opacity: op1,
              transform: `translateY(${y1}px)`,
            }}
          >
            Menos contexto acumulado.
          </div>

          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: THEME.colors.text,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              opacity: op2,
              transform: `translateY(${y2}px)`,
            }}
          >
            Mais rigor analítico.
          </div>

          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              color: THEME.colors.emerald,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              opacity: op3,
              transform: `translateY(${y3}px)`,
            }}
          >
            Fração do custo em tokens.
          </div>
        </div>

        {/* Hairline Divider & Footer */}
        <div
          style={{
            marginTop: 64,
            opacity: footerOp,
          }}
        >
          <div
            style={{
              width: '100%',
              height: 1,
              backgroundColor: THEME.colors.border,
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 32,
              fontFamily: THEME.fonts.mono,
              fontSize: 34,
            }}
          >
            <div style={{ color: THEME.colors.textSecondary }}>
              Gemini 4 Argon + Gemini 3.8 Flash
            </div>
            <div style={{ color: THEME.colors.text, fontWeight: 600 }}>
              github.com/EmersonPalatti/game-review
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
