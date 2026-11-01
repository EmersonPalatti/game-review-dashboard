import React from 'react';
import { interpolate, interpolateColors, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

export const Scene2_AgentsMd: React.FC = () => {
  const frame = useCurrentFrame();

  // Entrance
  const leftOpacity = interpolate(frame, [0, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leftY = interpolate(frame, [0, 32], [24, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  const cardOpacity = interpolate(frame, [8, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardX = interpolate(frame, [8, 40], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Highlight sequence for lines in 60fps
  // Line 2 (explorer): frames 42 to 68
  const hl1 = interpolate(frame, [42, 68], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Line 3 (executor): frames 90 to 116
  const hl2 = interpolate(frame, [90, 116], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Line 5 (ZERO histórico): frames 140 to 166
  const hl3 = interpolate(frame, [140, 166], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Line 6 (resumo + log): frames 185 to 212
  const hl4 = interpolate(frame, [185, 212], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  const color1 = interpolateColors(hl1, [0, 1], [THEME.colors.textSecondary, THEME.colors.text]);
  const color2 = interpolateColors(hl2, [0, 1], [THEME.colors.textSecondary, THEME.colors.text]);
  const color3 = interpolateColors(hl3, [0, 1], [THEME.colors.textSecondary, THEME.colors.text]);
  const color4 = interpolateColors(hl4, [0, 1], [THEME.colors.textSecondary, THEME.colors.text]);

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
          padding: '0 120px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 60,
          boxSizing: 'border-box',
        }}
      >
        {/* Left Column (38% width) */}
        <div
          style={{
            width: 600,
            opacity: leftOpacity,
            transform: `translateY(${leftY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: THEME.colors.text,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
            }}
          >
            O prompt não explica os dados.{' '}
            <span style={{ color: THEME.colors.emerald }}>Só a delegação.</span>
          </div>

          <div
            style={{
              fontSize: 32,
              fontWeight: 400,
              color: THEME.colors.textSecondary,
              marginTop: 36,
              lineHeight: 1.4,
            }}
          >
            Zero contaminação. Cada subagente começa sem histórico e devolve
            apenas o resultado auditado.
          </div>
        </div>

        {/* Right Column: AGENTS.md window (62% width) */}
        <div
          style={{
            flex: 1,
            opacity: cardOpacity,
            transform: `translateX(${cardX}px)`,
            backgroundColor: THEME.colors.surface,
            borderRadius: 18,
            border: `1px solid ${THEME.colors.border}`,
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
          }}
        >
          {/* Editor Header */}
          <div
            style={{
              height: 64,
              padding: '0 28px',
              backgroundColor: THEME.colors.raised,
              borderBottom: `1px solid ${THEME.colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', gap: 10 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                }}
              />
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                }}
              />
            </div>
            <div
              style={{
                fontFamily: THEME.fonts.mono,
                fontSize: 28,
                fontWeight: 600,
                color: THEME.colors.textSecondary,
                letterSpacing: '-0.01em',
              }}
            >
              AGENTS.md
            </div>
          </div>

          {/* Editor Code Body */}
          <div
            style={{
              padding: '44px 48px',
              fontFamily: THEME.fonts.mono,
              fontSize: 34,
              lineHeight: 1.7,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Line 1 */}
            <div style={{ color: THEME.colors.textMuted }}># AGENTS.md</div>

            {/* Line 2 */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                backgroundColor: `rgba(229, 160, 0, ${hl1 * 0.12})`,
                color: color1,
                transform: `translateX(${hl1 * 6}px)`,
                transition: 'none',
              }}
            >
              <span style={{ color: THEME.colors.amber, fontWeight: 600 }}>
                explorer
              </span>{' '}
              → Gemini 3.8 Flash{' '}
              <span style={{ color: THEME.colors.textMuted }}>(lê CSVs)</span>
            </div>

            {/* Line 3 */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                backgroundColor: `rgba(229, 160, 0, ${hl2 * 0.12})`,
                color: color2,
                transform: `translateX(${hl2 * 6}px)`,
                transition: 'none',
              }}
            >
              <span style={{ color: THEME.colors.amber, fontWeight: 600 }}>
                executor
              </span>{' '}
              → Gemini 3.8 Flash{' '}
              <span style={{ color: THEME.colors.textMuted }}>(gera código)</span>
            </div>

            {/* Empty space */}
            <div style={{ height: 12 }} />

            {/* Line 5 */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                backgroundColor: `rgba(62, 207, 142, ${hl3 * 0.14})`,
                color: color3,
                transform: `translateX(${hl3 * 6}px)`,
                transition: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ color: THEME.colors.emerald }}>•</span>
              <span>
                Iniciam com{' '}
                <strong style={{ color: THEME.colors.emerald }}>
                  ZERO histórico
                </strong>
              </span>
            </div>

            {/* Line 6 */}
            <div
              style={{
                padding: '6px 14px',
                borderRadius: 8,
                backgroundColor: `rgba(62, 207, 142, ${hl4 * 0.14})`,
                color: color4,
                transform: `translateX(${hl4 * 6}px)`,
                transition: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <span style={{ color: THEME.colors.emerald }}>•</span>
              <span>
                Retornam só{' '}
                <strong style={{ color: THEME.colors.emerald }}>
                  resumo + log
                </strong>{' '}
                (Exit 0)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
