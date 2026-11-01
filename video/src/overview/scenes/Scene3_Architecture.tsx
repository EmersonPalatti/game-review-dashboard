import React from 'react';
import { interpolate, useCurrentFrame, Easing } from 'remotion';
import { THEME } from '../theme';

// Parametric cubic bezier helper
function getBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  const x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
  const y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;

  return { x, y };
}

export const Scene3_Architecture: React.FC = () => {
  const frame = useCurrentFrame();

  // Flow coordinates
  const p1_0 = { x: 620, y: 480 };
  const p1_1 = { x: 950, y: 480 };
  const p1_2 = { x: 950, y: 350 };
  const p1_3 = { x: 1280, y: 350 };

  const p2_0 = { x: 620, y: 600 };
  const p2_1 = { x: 950, y: 600 };
  const p2_2 = { x: 950, y: 730 };
  const p2_3 = { x: 1280, y: 730 };

  const path1 = `M ${p1_0.x} ${p1_0.y} C ${p1_1.x} ${p1_1.y}, ${p1_2.x} ${p1_2.y}, ${p1_3.x} ${p1_3.y}`;
  const path2 = `M ${p2_0.x} ${p2_0.y} C ${p2_1.x} ${p2_1.y}, ${p2_2.x} ${p2_2.y}, ${p2_3.x} ${p2_3.y}`;

  // Inverse paths for Phase B (from Flash to Argon)
  const path1_inv = `M ${p1_3.x} ${p1_3.y} C ${p1_2.x} ${p1_2.y}, ${p1_1.x} ${p1_1.y}, ${p1_0.x} ${p1_0.y}`;
  const path2_inv = `M ${p2_3.x} ${p2_3.y} C ${p2_2.x} ${p2_2.y}, ${p2_1.x} ${p2_1.y}, ${p2_0.x} ${p2_0.y}`;

  // Fase A (frames 36–130): Argon -> Subagents
  const tA = interpolate(frame, [36, 126], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const lineAOpacity = interpolate(frame, [36, 48, 125, 150], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const packetAOpacity = interpolate(frame, [36, 48, 118, 132], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tA0 = tA;
  const tA1 = Math.max(0, tA - 0.04);
  const tA2 = Math.max(0, tA - 0.08);

  const posA1_0 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tA0);
  const posA1_1 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tA1);
  const posA1_2 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tA2);

  const posA2_0 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tA0);
  const posA2_1 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tA1);
  const posA2_2 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tA2);

  // Label Fase A (frames 44-136)
  const labelAOpacity = interpolate(frame, [44, 64, 116, 136], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelAY = interpolate(frame, [44, 64], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Fase B (frames 152–248): Subagents -> Argon (retorno)
  const tB_progress = interpolate(frame, [152, 242], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  const tB = 1 - tB_progress;

  const lineBOpacity = interpolate(frame, [152, 164, 240, 270], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const packetBOpacity = interpolate(frame, [152, 164, 236, 250], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tB0 = tB;
  const tB1 = Math.min(1, tB + 0.04);
  const tB2 = Math.min(1, tB + 0.08);

  const posB1_0 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tB0);
  const posB1_1 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tB1);
  const posB1_2 = getBezierPoint(p1_0, p1_1, p1_2, p1_3, tB2);

  const posB2_0 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tB0);
  const posB2_1 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tB1);
  const posB2_2 = getBezierPoint(p2_0, p2_1, p2_2, p2_3, tB2);

  // Label Fase B (frames 160-256)
  const labelBOpacity = interpolate(frame, [160, 180, 236, 256], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const labelBY = interpolate(frame, [160, 180], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Crossfade suave nos subagentes (frames 140-164)
  const statusProgress = interpolate(frame, [140, 164], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });

  // Selo Auditado no Disco (frames 216-244)
  const sealOpacity = interpolate(frame, [216, 244], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sealScale = interpolate(frame, [216, 244], [0.94, 1], {
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
      {/* Fixed Scene Header */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 88,
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          zIndex: 10,
        }}
      >
        <span style={{ color: THEME.colors.text }}>
          O modelo principal planeja e audita.{' '}
        </span>
        <span style={{ color: THEME.colors.amber }}>O Flash executa.</span>
      </div>

      {/* SVG Connecting Tracks & Animated Beams */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          width: 1920,
          height: 1080,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        {/* Base tracks */}
        <path
          d={path1}
          fill="none"
          stroke={THEME.colors.border}
          strokeWidth="3"
        />
        <path
          d={path2}
          fill="none"
          stroke={THEME.colors.border}
          strokeWidth="3"
        />

        {/* Phase A: Progressive Amber Beam */}
        {lineAOpacity > 0 && (
          <>
            <path
              d={path1}
              fill="none"
              stroke={THEME.colors.amber}
              strokeWidth="3.5"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - tA}
              opacity={lineAOpacity}
            />
            <path
              d={path2}
              fill="none"
              stroke={THEME.colors.amber}
              strokeWidth="3.5"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - tA}
              opacity={lineAOpacity}
            />
          </>
        )}

        {/* Phase A: Amber Packets with Trailer */}
        {packetAOpacity > 0 && (
          <>
            {/* Trail circle 2 */}
            <circle cx={posA1_2.x} cy={posA1_2.y} r="4" fill={THEME.colors.amber} opacity={packetAOpacity * 0.3} />
            <circle cx={posA2_2.x} cy={posA2_2.y} r="4" fill={THEME.colors.amber} opacity={packetAOpacity * 0.3} />
            {/* Trail circle 1 */}
            <circle cx={posA1_1.x} cy={posA1_1.y} r="6" fill={THEME.colors.amber} opacity={packetAOpacity * 0.6} />
            <circle cx={posA2_1.x} cy={posA2_1.y} r="6" fill={THEME.colors.amber} opacity={packetAOpacity * 0.6} />
            {/* Lead circle */}
            <circle cx={posA1_0.x} cy={posA1_0.y} r="8" fill={THEME.colors.amber} opacity={packetAOpacity} />
            <circle cx={posA2_0.x} cy={posA2_0.y} r="8" fill={THEME.colors.amber} opacity={packetAOpacity} />
          </>
        )}

        {/* Phase B: Progressive Emerald Beam */}
        {lineBOpacity > 0 && (
          <>
            <path
              d={path1_inv}
              fill="none"
              stroke={THEME.colors.emerald}
              strokeWidth="3.5"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - tB_progress}
              opacity={lineBOpacity}
            />
            <path
              d={path2_inv}
              fill="none"
              stroke={THEME.colors.emerald}
              strokeWidth="3.5"
              pathLength={1}
              strokeDasharray="1"
              strokeDashoffset={1 - tB_progress}
              opacity={lineBOpacity}
            />
          </>
        )}

        {/* Phase B: Emerald Packets with Trailer */}
        {packetBOpacity > 0 && (
          <>
            {/* Trail circle 2 */}
            <circle cx={posB1_2.x} cy={posB1_2.y} r="4" fill={THEME.colors.emerald} opacity={packetBOpacity * 0.3} />
            <circle cx={posB2_2.x} cy={posB2_2.y} r="4" fill={THEME.colors.emerald} opacity={packetBOpacity * 0.3} />
            {/* Trail circle 1 */}
            <circle cx={posB1_1.x} cy={posB1_1.y} r="6" fill={THEME.colors.emerald} opacity={packetBOpacity * 0.6} />
            <circle cx={posB2_1.x} cy={posB2_1.y} r="6" fill={THEME.colors.emerald} opacity={packetBOpacity * 0.6} />
            {/* Lead circle */}
            <circle cx={posB1_0.x} cy={posB1_0.y} r="8" fill={THEME.colors.emerald} opacity={packetBOpacity} />
            <circle cx={posB2_0.x} cy={posB2_0.y} r="8" fill={THEME.colors.emerald} opacity={packetBOpacity} />
          </>
        )}
      </svg>

      {/* Floating Track Labels (centered between tracks) */}
      {labelAOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 950,
            top: 540,
            transform: `translate(-50%, -50%) translateY(${labelAY}px)`,
            opacity: labelAOpacity,
            zIndex: 15,
            backgroundColor: THEME.colors.raised,
            border: `1px solid ${THEME.colors.border}`,
            padding: '12px 28px',
            borderRadius: 12,
            fontSize: 28,
            fontWeight: 600,
            color: THEME.colors.amber,
            fontFamily: THEME.fonts.mono,
            whiteSpace: 'nowrap',
          }}
        >
          Prompt fechado • 0 histórico
        </div>
      )}

      {labelBOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 950,
            top: 540,
            transform: `translate(-50%, -50%) translateY(${labelBY}px)`,
            opacity: labelBOpacity,
            zIndex: 15,
            backgroundColor: THEME.colors.raised,
            border: `1px solid ${THEME.colors.emerald}`,
            padding: '12px 28px',
            borderRadius: 12,
            fontSize: 28,
            fontWeight: 600,
            color: THEME.colors.emerald,
            fontFamily: THEME.fonts.mono,
            whiteSpace: 'nowrap',
          }}
        >
          Resumo + Log Validado
        </div>
      )}

      {/* Node Left: Gemini 4 Argon */}
      <div
        style={{
          position: 'absolute',
          left: 140,
          top: 380,
          width: 480,
          padding: '40px 44px',
          backgroundColor: THEME.colors.surface,
          borderRadius: 20,
          border: `1px solid ${THEME.colors.border}`,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: THEME.colors.text,
            letterSpacing: '-0.03em',
          }}
        >
          Gemini 4 Argon
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 500,
            color: THEME.colors.emerald,
            marginTop: 10,
            letterSpacing: '-0.01em',
          }}
        >
          Orquestrador • Janela Limpa
        </div>

        {/* Audit Seal */}
        <div
          style={{
            marginTop: 28,
            opacity: sealOpacity,
            transform: `scale(${sealScale})`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 20px',
            backgroundColor: THEME.colors.raised,
            border: `1px solid ${THEME.colors.emerald}`,
            borderRadius: 10,
            fontSize: 28,
            fontWeight: 600,
            color: THEME.colors.emerald,
            fontFamily: THEME.fonts.mono,
          }}
        >
          <span style={{ fontSize: 24 }}>✓</span>
          <span>Auditado no disco</span>
        </div>
      </div>

      {/* Node Right Top: explorer (Gemini 3.8 Flash) */}
      <div
        style={{
          position: 'absolute',
          left: 1280,
          top: 250,
          width: 520,
          padding: '30px 36px',
          backgroundColor: THEME.colors.surface,
          borderRadius: 18,
          border: `1px solid ${THEME.colors.border}`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: THEME.colors.text,
              letterSpacing: '-0.02em',
            }}
          >
            explorer
          </div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: THEME.colors.amber,
              fontFamily: THEME.fonts.mono,
            }}
          >
            Flash 3.8
          </span>
        </div>

        {/* Crossfade container for status */}
        <div
          style={{
            position: 'relative',
            height: 40,
            marginTop: 16,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              fontSize: 28,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.textSecondary,
              whiteSpace: 'nowrap',
              opacity: 1 - statusProgress,
              transform: `translateY(${-statusProgress * 8}px)`,
            }}
          >
            Processando 460 MB CSVs...
          </div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              fontSize: 28,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.textMuted,
              whiteSpace: 'nowrap',
              opacity: statusProgress,
              transform: `translateY(${(1 - statusProgress) * 8}px)`,
            }}
          >
            460 MB retidos (descartados)
          </div>
        </div>
      </div>

      {/* Node Right Bottom: executor (Gemini 3.8 Flash) */}
      <div
        style={{
          position: 'absolute',
          left: 1280,
          top: 630,
          width: 520,
          padding: '30px 36px',
          backgroundColor: THEME.colors.surface,
          borderRadius: 18,
          border: `1px solid ${THEME.colors.border}`,
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          zIndex: 10,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontSize: 38,
              fontWeight: 700,
              color: THEME.colors.text,
              letterSpacing: '-0.02em',
            }}
          >
            executor
          </div>
          <span
            style={{
              fontSize: 26,
              fontWeight: 600,
              color: THEME.colors.amber,
              fontFamily: THEME.fonts.mono,
            }}
          >
            Flash 3.8
          </span>
        </div>

        {/* Crossfade container for status */}
        <div
          style={{
            position: 'relative',
            height: 40,
            marginTop: 16,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              fontSize: 28,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.textSecondary,
              whiteSpace: 'nowrap',
              opacity: 1 - statusProgress,
              transform: `translateY(${-statusProgress * 8}px)`,
            }}
          >
            Executando código...
          </div>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              fontSize: 28,
              fontFamily: THEME.fonts.mono,
              color: THEME.colors.emerald,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              opacity: statusProgress,
              transform: `translateY(${(1 - statusProgress) * 8}px)`,
            }}
          >
            analysis.ipynb • Exit 0
          </div>
        </div>
      </div>
    </div>
  );
};
