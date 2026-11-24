import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { Badge, BotBubble, DatabaseIcon, MOCK, MockPanel, PANEL_HEADER_H, UserBubble } from '../mock/ChatMock';
import { V1 } from '../mock/data';
import { COLORS, CONTENT, EASE_OUT, FONTS, withAlpha } from '../tokens';

const PANEL_H = 382;
const AXIS_TOP = PANEL_H + 26; // 408
const AXIS_H = 86;
const LIMITS_TOP = AXIS_TOP + AXIS_H + 18; // 512

/** Relógio simulado: 0 → 24,4 s em 8× (24,4 × 60 / 8 = 183 frames). */
const CLOCK_START = 40;
const CLOCK_FRAMES = 183;
const CLOCK_END = CLOCK_START + CLOCK_FRAMES; // 223

const ANSWER_FADE_FRAMES = 10;

const LIMITS = [
  'Etapas do loading por cronômetro',
  'Enxergava 10 dos 59 jogos',
  'Não buscava no texto das reviews',
  '1 modelo, 900 tokens, sem plano B',
] as const;

function formatSeconds(value: number): string {
  return `${value.toFixed(1).replace('.', ',')} s`;
}

/** Ícone 3×3 de pontos pulsando deterministicamente pelo frame. */
const DotMatrixIcon: React.FC<{ frame: number; color: string }> = ({ frame, color }) => {
  const coords = [4, 12, 20];
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
      {coords.map((cy, row) =>
        coords.map((cx, col) => {
          const wave = 0.5 + 0.5 * Math.sin(frame * 0.22 - (row * 0.85 + col * 0.65));
          const opacity = 0.25 + 0.75 * wave;
          return <circle key={`${row}-${col}`} cx={cx} cy={cy} r={2.3} fill={color} opacity={opacity} />;
        }),
      )}
    </svg>
  );
};

/**
 * Cena 1 (100% motion) · O teto do v1 (420 frames).
 * Mostra o loader guiado por cronômetro (trocas fixas em 2,2 s e 5,5 s,
 * depois ~19 s parado em 3/3 até a resposta chegar inteira em 24,4 s)
 * e os quatro limites arquiteturais abaixo.
 */
export const M1_Before: React.FC = () => {
  const frame = useCurrentFrame();

  const panelIn = enterUp(frame, 0, 22, 20);
  const questionIn = enterUp(frame, 8, 20, 14);
  const loaderIn = enterUp(frame, 18, 18, 12);
  const axisIn = enterUp(frame, 36, 22, 16);

  const simSeconds = interpolate(frame, [CLOCK_START, CLOCK_END], [0, V1.waitSeconds], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const stageIndex = simSeconds >= V1.stages[2].from ? 2 : simSeconds >= V1.stages[1].from ? 1 : 0;
  const currentStage = V1.stages[stageIndex];

  const tickerIndex = Math.floor(simSeconds / V1.tickerEveryS) % V1.tickerLines.length;
  const tickerLine = V1.tickerLines[tickerIndex];
  const tickerPhase = (simSeconds % V1.tickerEveryS) / V1.tickerEveryS;
  const tickerOpacity = frame < CLOCK_START ? 1 : Math.min(1, tickerPhase * 6);

  const showAnswer = frame >= CLOCK_END;
  const answerOpacity = progress(frame, CLOCK_END, ANSWER_FADE_FRAMES, EASE_OUT);

  const speedBadgeOpacity =
    frame >= CLOCK_START && frame < CLOCK_END + 6
      ? Math.min(
          progress(frame, CLOCK_START, 10, EASE_OUT),
          1 - progress(frame, CLOCK_END - 6, 10, EASE_OUT),
        )
      : 0;

  const panelDim = interpolate(frame, [300, 330], [1, 0.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Geometria da régua de tempo (0 → 24,4 s em 936 px)
  const playheadRatio = simSeconds / V1.waitSeconds;
  const playheadX = playheadRatio * CONTENT.width;
  const t1X = (V1.stages[1].from / V1.waitSeconds) * CONTENT.width; // 2,2 s
  const t2X = (V1.stages[2].from / V1.waitSeconds) * CONTENT.width; // 5,5 s
  const redSpanWidth = Math.max(0, playheadX - t2X);
  const stuckLabelOpacity =
    simSeconds >= 12 ? interpolate(simSeconds, [12, 14.5], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const endLabelOpacity = progress(frame, CLOCK_END, 14, EASE_OUT);

  // Shimmer suave no texto da etapa atual enquanto o relógio corre
  const shimmerPos = ((frame * 2.2) % 200) - 50;
  const stageGradient =
    frame >= CLOCK_START && frame < CLOCK_END
      ? {
          backgroundImage: `linear-gradient(90deg, ${COLORS.text} 0%, ${COLORS.text} ${shimmerPos - 18}%, ${COLORS.amber} ${shimmerPos}%, ${COLORS.text} ${shimmerPos + 18}%, ${COLORS.text} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }
      : { color: COLORS.text };

  return (
    <SceneShell
      kicker="Antes · chat v1"
      headline="O v1 respondia. Mas batia no teto."
      why="O limite estava na arquitetura, não no prompt."
      whyFrom={300}
    >
      {/* 1. Painel simulado do chat v1 */}
      <div style={{ position: 'relative', width: CONTENT.width, height: PANEL_H, ...panelIn }}>
        <MockPanel version="v1" width={CONTENT.width} height={PANEL_H} style={{ opacity: panelDim }}>
          <div
            style={{
              height: PANEL_H - PANEL_HEADER_H,
              padding: '14px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              boxSizing: 'border-box',
            }}
          >
            <div style={questionIn}>
              <UserBubble text={V1.question} maxWidth="84%" />
            </div>

            {!showAnswer ? (
              <div
                style={{
                  width: '100%',
                  borderRadius: 14,
                  backgroundColor: MOCK.wellBg,
                  border: `1px solid ${COLORS.border}`,
                  padding: '14px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  boxSizing: 'border-box',
                  ...loaderIn,
                }}
              >
                {/* Linha 1: matriz 3×3 + texto da etapa + cronômetro */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <DotMatrixIcon frame={frame} color={COLORS.amber} />
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 500,
                      lineHeight: 1.2,
                      letterSpacing: '-0.015em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      flex: 1,
                      ...stageGradient,
                    }}
                  >
                    {currentStage.text}
                  </span>
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 24,
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                      color: stageIndex === 2 ? COLORS.amber : COLORS.textSecondary,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {formatSeconds(simSeconds)}
                  </span>
                </div>

                {/* Linha 2: trilha de 3 segmentos */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  {[0, 1, 2].map((idx) => {
                    const segColor =
                      idx === stageIndex
                        ? COLORS.amber
                        : idx < stageIndex
                          ? COLORS.textSecondary
                          : withAlpha(COLORS.textMuted, 0.32);
                    return (
                      <div
                        key={idx}
                        style={{
                          height: 5,
                          borderRadius: 999,
                          backgroundColor: segColor,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Linha 3: ícone de banco + ticker SQL */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: tickerOpacity }}>
                  <DatabaseIcon size={22} color={COLORS.textMuted} />
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 24,
                      color: COLORS.textSecondary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: 1.2,
                    }}
                  >
                    {tickerLine}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ opacity: answerOpacity }}>
                <BotBubble style={{ padding: '14px 18px', gap: 8 }}>
                  <div
                    style={{
                      fontSize: 24,
                      lineHeight: 1.32,
                      color: COLORS.text,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {V1.answerStart}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                    <Badge tone="red">chegou inteira, de uma vez</Badge>
                  </div>
                </BotBubble>
              </div>
            )}
          </div>
        </MockPanel>

        {/* Selo 8× acelerado no canto superior direito durante o relógio */}
        {speedBadgeOpacity > 0 ? (
          <div
            style={{
              position: 'absolute',
              top: 22,
              right: 24,
              padding: '6px 14px',
              borderRadius: 999,
              backgroundColor: withAlpha('#0E0E10', 0.86),
              border: `1px solid ${COLORS.borderLight}`,
              fontFamily: FONTS.mono,
              fontSize: 24,
              color: COLORS.text,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              opacity: speedBadgeOpacity,
            }}
          >
            <svg width={22} height={14} viewBox="0 0 22 14" aria-hidden>
              <path d="M1 1 L10 7 L1 13 Z M11 1 L20 7 L11 13 Z" fill={COLORS.amber} />
            </svg>
            8× acelerado
          </div>
        ) : null}
      </div>

      {/* 2. Régua do cronômetro abaixo do painel */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: AXIS_TOP,
          width: CONTENT.width,
          height: AXIS_H,
          ...axisIn,
        }}
      >
        {/* Legenda à esquerda acima da trilha */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            fontFamily: FONTS.mono,
            fontSize: 24,
            color: COLORS.textMuted,
            lineHeight: 1.2,
          }}
        >
          etapas trocadas por cronômetro
        </div>

        {/* Trilha horizontal 0 → 24,4 s */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 38,
            width: CONTENT.width,
            height: 8,
            borderRadius: 999,
            backgroundColor: COLORS.raised,
            border: `1px solid ${COLORS.border}`,
            boxSizing: 'border-box',
          }}
        />

        {/* Preenchimento âmbar de 0 → 5,5 s conforme o playhead avança */}
        {playheadX > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 38,
              width: Math.min(playheadX, t2X),
              height: 8,
              borderRadius: redSpanWidth > 0 ? '999px 0 0 999px' : 999,
              backgroundColor: withAlpha(COLORS.amber, 0.55),
            }}
          />
        ) : null}

        {/* Trecho 5,5 s → playhead preenchido com tom vermelho */}
        {redSpanWidth > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: t2X,
              top: 34,
              width: redSpanWidth,
              height: 16,
              borderRadius: '0 999px 999px 0',
              backgroundColor: withAlpha(COLORS.red, 0.28),
              borderTop: `1px solid ${withAlpha(COLORS.red, 0.5)}`,
              borderBottom: `1px solid ${withAlpha(COLORS.red, 0.5)}`,
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 3,
                right: 0,
                height: 8,
                borderRadius: '0 999px 999px 0',
                backgroundColor: withAlpha(COLORS.red, 0.72),
              }}
            />
          </div>
        ) : null}

        {/* Ticks em 2,2 s e 5,5 s */}
        {[
          { x: t1X, label: '2,2 s' },
          { x: t2X, label: '5,5 s' },
        ].map((tick) => (
          <React.Fragment key={tick.label}>
            <div
              style={{
                position: 'absolute',
                left: tick.x - 1.5,
                top: 32,
                width: 3,
                height: 20,
                borderRadius: 2,
                backgroundColor: COLORS.amber,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: tick.x,
                top: 56,
                transform: 'translateX(-50%)',
                fontFamily: FONTS.mono,
                fontSize: 24,
                color: COLORS.amber,
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {tick.label}
            </div>
          </React.Fragment>
        ))}

        {/* Rótulo no trecho vermelho quando passa de ~12 s */}
        {stuckLabelOpacity > 0 ? (
          <div
            style={{
              position: 'absolute',
              left: 550,
              top: 56,
              transform: 'translateX(-50%)',
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 500,
              color: COLORS.red,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              opacity: stuckLabelOpacity,
            }}
          >
            parado em 3/3
          </div>
        ) : null}

        {/* 24,4 s no fim em vermelho (f223+) */}
        {endLabelOpacity > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 56,
              fontFamily: FONTS.mono,
              fontSize: 24,
              fontWeight: 600,
              color: COLORS.red,
              whiteSpace: 'nowrap',
              lineHeight: 1.2,
              opacity: endLabelOpacity,
            }}
          >
            24,4 s
          </div>
        ) : null}

        {/* Playhead (ponto âmbar) */}
        <div
          style={{
            position: 'absolute',
            left: Math.max(8, Math.min(CONTENT.width - 8, playheadX)) - 8,
            top: 34,
            width: 16,
            height: 16,
            borderRadius: 999,
            backgroundColor: COLORS.amber,
            border: `2px solid ${COLORS.bg}`,
            boxShadow: `0 0 0 2px ${withAlpha(COLORS.amber, 0.35)}`,
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* 3. Quatro limites arquiteturais */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: LIMITS_TOP,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 9,
        }}
      >
        {LIMITS.map((text, i) => (
          <div key={text} style={enterUp(frame, 240 + i * 24, 20, 14)}>
            <Tag
              tone="red"
              fontSize={24}
              style={{
                padding: '9px 18px',
                color: COLORS.text,
                borderColor: withAlpha(COLORS.red, 0.55),
              }}
            >
              <span style={{ color: COLORS.red }}>×</span>
              {text}
            </Tag>
          </div>
        ))}
      </div>
    </SceneShell>
  );
};
