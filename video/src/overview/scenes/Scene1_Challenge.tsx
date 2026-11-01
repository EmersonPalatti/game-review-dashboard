import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

export const Scene1_Challenge: React.FC = () => {
  const frame = useCurrentFrame();

  // Batida 1: Contador 0 -> 1.000.000 (frames 6 a 76)
  const count = Math.round(
    interpolate(frame, [6, 76], [0, 1000000], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  );
  const formattedCount = count.toLocaleString('pt-BR');

  // Entrada do topo (frames 0 a 28)
  const topOpacity = interpolate(frame, [0, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const topY = interpolate(frame, [0, 28], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Divisor horizontal (frames 72 a 112)
  const dividerWidth = interpolate(frame, [72, 112], [0, 1680], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Batida 2: 0 linhas de dicionário de dados (frames 88 a 120)
  const leftOpacity = interpolate(frame, [88, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftY = interpolate(frame, [88, 120], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Batida 3: 24 linhas no AGENTS.md (frames 150 a 184)
  const rightOpacity = interpolate(frame, [150, 184], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const rightY = interpolate(frame, [150, 184], [28, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Contador suave de 0 a 24 linhas (frames 150 a 190)
  const linesCount = Math.round(
    interpolate(frame, [150, 190], [0, 24], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  );

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
          padding: '100px 120px',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          boxSizing: 'border-box',
          justifyContent: 'center',
        }}
      >
        {/* Top: 1.000.000 de reviews + 460 MB em 4 CSVs */}
        <div
          style={{
            opacity: topOpacity,
            transform: `translateY(${topY}px)`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 32 }}>
            <span
              style={{
                fontSize: 148,
                fontWeight: 700,
                color: THEME.colors.text,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formattedCount}
            </span>
            <div
              style={{
                padding: '14px 28px',
                backgroundColor: THEME.colors.raised,
                border: `1px solid ${THEME.colors.border}`,
                borderRadius: 12,
                fontSize: 38,
                fontWeight: 600,
                color: THEME.colors.textSecondary,
                fontFamily: THEME.fonts.mono,
              }}
            >
              460 MB em 4 CSVs
            </div>
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 500,
              color: THEME.colors.textSecondary,
              marginTop: 18,
              letterSpacing: '-0.02em',
            }}
          >
            Reviews da Steam analisadas por IA
          </div>
        </div>

        {/* Hairline Divider */}
        <div
          style={{
            width: dividerWidth,
            height: 1,
            backgroundColor: THEME.colors.border,
            marginTop: 48,
            marginBottom: 48,
          }}
        />

        {/* Base: 0 linhas vs 24 linhas */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 80,
          }}
        >
          {/* Batida 2: 0 linhas */}
          <div
            style={{
              opacity: leftOpacity,
              transform: `translateY(${leftY}px)`,
            }}
          >
            <div
              style={{
                fontSize: 124,
                fontWeight: 700,
                color: THEME.colors.red,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              0 linhas
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 500,
                color: THEME.colors.textSecondary,
                marginTop: 18,
                letterSpacing: '-0.01em',
              }}
            >
              de dicionário de dados
            </div>
          </div>

          {/* Batida 3: 24 linhas no AGENTS.md */}
          <div
            style={{
              opacity: rightOpacity,
              transform: `translateY(${rightY}px)`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 24 }}>
              <span
                style={{
                  fontSize: 124,
                  fontWeight: 700,
                  color: THEME.colors.emerald,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {linesCount} linhas
              </span>
              <span
                style={{
                  padding: '8px 20px',
                  backgroundColor: THEME.colors.raised,
                  border: `1px solid ${THEME.colors.border}`,
                  borderRadius: 10,
                  fontSize: 28,
                  fontWeight: 600,
                  color: THEME.colors.emerald,
                  fontFamily: THEME.fonts.mono,
                }}
              >
                Blind Test
              </span>
            </div>
            <div
              style={{
                fontSize: 38,
                fontWeight: 500,
                color: THEME.colors.textSecondary,
                marginTop: 18,
                letterSpacing: '-0.01em',
              }}
            >
              no AGENTS.md
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
