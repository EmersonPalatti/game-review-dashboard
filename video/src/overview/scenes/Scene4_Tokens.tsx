import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

export const Scene4_Tokens: React.FC = () => {
  const frame = useCurrentFrame();

  const titleOpacity = interpolate(frame, [0, 24], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [0, 24], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Barra 1: Agente Único (cresce de 40 a 920px entre frames 28 e 120)
  const barWidth1 = interpolate(frame, [28, 120], [40, 920], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const percent1 = Math.round(
    interpolate(frame, [28, 120], [0, 100], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  );

  // Barra 2: Argon + Subagentes Flash (opacidade entra frames 92-116, barra cresce 0 a 368px frames 100-160)
  const bar2Opacity = interpolate(frame, [92, 116], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const barWidth2 = interpolate(frame, [100, 160], [0, 368], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const percent2 = Math.round(
    interpolate(frame, [100, 160], [0, 40], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    })
  );

  // Badges (entram nos frames 144 a 176)
  const badgeOpacity = interpolate(frame, [144, 176], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const badgeScale = interpolate(frame, [144, 176], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
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
          padding: '80px 140px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        {/* Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            marginBottom: 60,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 700,
              color: THEME.colors.text,
              letterSpacing: '-0.03em',
              lineHeight: 1.05,
            }}
          >
            O trabalho bruto fica fora da janela principal
          </div>
        </div>

        {/* Comparison Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 52 }}>
          {/* Item 1: Agente Único */}
          <div>
            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: THEME.colors.red,
                marginBottom: 16,
                letterSpacing: '-0.01em',
              }}
            >
              Agente Único (mesma conversa)
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
              <div
                style={{
                  width: barWidth1,
                  height: 68,
                  backgroundColor: THEME.colors.red,
                  borderRadius: 8,
                }}
              />
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.mono,
                  color: THEME.colors.red,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                {percent1}% da janela
              </span>
            </div>

            <div
              style={{
                fontSize: 28,
                color: THEME.colors.textSecondary,
                marginTop: 14,
              }}
            >
              CSVs + Pandas outputs + JSON do notebook reprocessados no modelo caro a cada turno
            </div>
          </div>

          {/* Item 2: Argon + Subagentes Flash */}
          <div style={{ opacity: bar2Opacity }}>
            <div
              style={{
                fontSize: 36,
                fontWeight: 600,
                color: THEME.colors.emerald,
                marginBottom: 16,
                letterSpacing: '-0.01em',
              }}
            >
              Argon + Subagentes Flash
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
              <div
                style={{
                  width: barWidth2,
                  height: 68,
                  backgroundColor: THEME.colors.emerald,
                  borderRadius: 8,
                }}
              />
              <span
                style={{
                  fontSize: 64,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.mono,
                  color: THEME.colors.emerald,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                  whiteSpace: 'nowrap',
                }}
              >
                ~{percent2}% da janela
              </span>

              {/* Badges Container */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  opacity: badgeOpacity,
                  transform: `scale(${badgeScale})`,
                  marginLeft: 16,
                }}
              >
                <div
                  style={{
                    padding: '12px 24px',
                    backgroundColor: THEME.colors.raised,
                    border: `1px solid ${THEME.colors.borderLight}`,
                    borderRadius: 12,
                    fontSize: 32,
                    fontWeight: 700,
                    color: THEME.colors.text,
                    letterSpacing: '-0.02em',
                    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  -60% de contexto
                </div>

                <div
                  style={{
                    padding: '12px 24px',
                    backgroundColor: THEME.colors.raised,
                    border: `1px solid ${THEME.colors.emerald}`,
                    borderRadius: 12,
                    fontSize: 32,
                    fontWeight: 700,
                    color: THEME.colors.emerald,
                    letterSpacing: '-0.02em',
                    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.4)',
                  }}
                >
                  1,6x mais econômico
                </div>
              </div>
            </div>

            <div
              style={{
                fontSize: 28,
                color: THEME.colors.textSecondary,
                marginTop: 14,
              }}
            >
              Trabalho pesado roda no modelo mais leve (Flash); só resumos entram no Argon
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
