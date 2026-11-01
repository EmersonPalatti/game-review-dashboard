import React from 'react';
import { interpolate, interpolateColors, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

export const Scene5_Findings: React.FC = () => {
  const frame = useCurrentFrame();

  // Slide 0: entra em [0, 18], visível até 92, sai em [92, 106]
  const in0 = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const yIn0 = interpolate(frame, [0, 18], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const out0 = interpolate(frame, [92, 106], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const yOut0 = interpolate(frame, [92, 106], [0, -14], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const op0 = in0 * out0;

  // Slide 1: entra em [106, 122], visível até 202, sai em [202, 216]
  const in1 = interpolate(frame, [106, 122], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const yIn1 = interpolate(frame, [106, 122], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const out1 = interpolate(frame, [202, 216], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const yOut1 = interpolate(frame, [202, 216], [0, -14], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const op1 = in1 * out1;

  // Slide 2: entra em [216, 232] e fica até o fim da cena
  const in2 = interpolate(frame, [216, 232], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const yIn2 = interpolate(frame, [216, 232], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const op2 = in2;

  // Progress Bar Colors
  const colorBar1 = interpolateColors(
    frame,
    [106, 122],
    ['rgba(255, 255, 255, 0.15)', THEME.colors.text]
  );
  const colorBar2 = interpolateColors(
    frame,
    [216, 232],
    ['rgba(255, 255, 255, 0.15)', THEME.colors.text]
  );

  // Crossfade suave sincronizado nos números do slide (1/3, 2/3, 3/3)
  const labelOp0 = interpolate(frame, [98, 106], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY0 = interpolate(frame, [98, 106], [0, -6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelOp1In = interpolate(frame, [106, 114], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOp1Out = interpolate(frame, [208, 216], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelOp1 = labelOp1In * labelOp1Out;
  const labelY1In = interpolate(frame, [106, 114], [6, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY1Out = interpolate(frame, [208, 216], [0, -6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const labelOp2 = interpolate(frame, [216, 224], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelY2 = interpolate(frame, [216, 224], [6, 0], {
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
          padding: '100px 140px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
        }}
      >
        {/* Fixed Top Header & Progress */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: `1px solid ${THEME.colors.border}`,
            paddingBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: THEME.colors.textSecondary,
              letterSpacing: '-0.01em',
            }}
          >
            Descoberto nos CSVs sem dicionário:
          </div>

          {/* Progress Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: THEME.colors.text,
                }}
              />
              <div
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colorBar1,
                }}
              />
              <div
                style={{
                  width: 44,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: colorBar2,
                }}
              />
            </div>
            <div
              style={{
                position: 'relative',
                width: 56,
                height: 38,
                fontFamily: THEME.fonts.mono,
                fontSize: 32,
                fontWeight: 600,
                color: THEME.colors.text,
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  opacity: labelOp0,
                  transform: `translateY(${labelY0}px)`,
                }}
              >
                1/3
              </span>
              <span
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  opacity: labelOp1,
                  transform: `translateY(${labelY1In + labelY1Out}px)`,
                }}
              >
                2/3
              </span>
              <span
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  opacity: labelOp2,
                  transform: `translateY(${labelY2}px)`,
                }}
              >
                3/3
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Slides Container */}
        <div
          style={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            paddingTop: 30,
            paddingBottom: 40,
          }}
        >
          {/* Slide 0 */}
          {op0 > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                opacity: op0,
                transform: `translateY(${yIn0 + yOut0}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 136,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.mono,
                  color: THEME.colors.amber,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                4.294.967.295
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 600,
                  color: THEME.colors.text,
                  marginTop: 28,
                  letterSpacing: '-0.02em',
                }}
              >
                Bug de underflow uint32 em votes_funny
              </div>
              <div
                style={{
                  fontSize: 34,
                  color: THEME.colors.textSecondary,
                  marginTop: 18,
                  letterSpacing: '-0.01em',
                }}
              >
                49 registros com votos negativos convertidos em 2³² - 1
              </div>
            </div>
          )}

          {/* Slide 1 */}
          {op1 > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                opacity: op1,
                transform: `translateY(${yIn1 + yOut1}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 136,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.mono,
                  color: THEME.colors.text,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                9.639.004 chars
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 600,
                  color: THEME.colors.text,
                  marginTop: 28,
                  letterSpacing: '-0.02em',
                }}
              >
                Spam de copypasta em 1 única review
              </div>
              <div
                style={{
                  fontSize: 34,
                  color: THEME.colors.textSecondary,
                  marginTop: 18,
                  letterSpacing: '-0.01em',
                }}
              >
                Outlier extremo em Arma 3 distorcendo toda a média textual
              </div>
            </div>
          )}

          {/* Slide 2 */}
          {op2 > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                opacity: op2,
                transform: `translateY(${yIn2}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 136,
                  fontWeight: 700,
                  fontFamily: THEME.fonts.mono,
                  color: THEME.colors.emerald,
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                49,6% → 77,4%
              </div>
              <div
                style={{
                  fontSize: 56,
                  fontWeight: 600,
                  color: THEME.colors.text,
                  marginTop: 28,
                  letterSpacing: '-0.02em',
                }}
              >
                Salto de aprovação após 2h de jogo
              </div>
              <div
                style={{
                  fontSize: 34,
                  color: THEME.colors.textSecondary,
                  marginTop: 18,
                  letterSpacing: '-0.01em',
                }}
              >
                O efeito exato da janela de reembolso da Valve na base
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
