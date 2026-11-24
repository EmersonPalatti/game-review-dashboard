import React from 'react';
import { interpolate, interpolateColors, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Card } from '../components/Card';
import { Counter } from '../components/Counter';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { ChatClip } from '../footage/ChatClip';
import { COLORS, CONTENT, EASE_IN, EASE_IN_OUT, EASE_OUT, FONTS, TYPE, withAlpha } from '../tokens';

export const QUESTION = 'O que os jogadores de Arma 3 falam sobre crashes e otimização?';
export const KEYWORDS = ['crash', 'FPS', 'travamento', 'lag'];

const TRACK_X = 40;
const TRACK_W = CONTENT.width - TRACK_X * 2; // 856
const TRACK1_TOP = 0;
const TRACK1_H = 186;
const TRACK2_TOP = 204;
const TRACK2_H = 182;
const RRF_CENTER_X = CONTENT.width / 2; // 468
const RRF_CENTER_Y = 472;

// Caminhos dos dois conectores até as bordas laterais do nó RRF (468 ± 52).
const PATH_LEFT_FROM_TRACK2 = [
  `M ${TRACK_X} ${TRACK2_TOP + TRACK2_H / 2}`,
  `H 28`,
  `Q 14 ${TRACK2_TOP + TRACK2_H / 2} 14 ${TRACK2_TOP + TRACK2_H / 2 + 14}`,
  `V ${RRF_CENTER_Y - 14}`,
  `Q 14 ${RRF_CENTER_Y} 28 ${RRF_CENTER_Y}`,
  `H ${RRF_CENTER_X - 58}`,
].join(' ');

const PATH_RIGHT_FROM_TRACK1 = [
  `M ${TRACK_X + TRACK_W} ${TRACK1_TOP + TRACK1_H / 2}`,
  `H ${CONTENT.width - 28}`,
  `Q ${CONTENT.width - 14} ${TRACK1_TOP + TRACK1_H / 2} ${CONTENT.width - 14} ${TRACK1_TOP + TRACK1_H / 2 + 14}`,
  `V ${RRF_CENTER_Y - 14}`,
  `Q ${CONTENT.width - 14} ${RRF_CENTER_Y} ${CONTENT.width - 28} ${RRF_CENTER_Y}`,
  `H ${RRF_CENTER_X + 58}`,
].join(' ');

/**
 * Cena 4 · Busca híbrida (420 frames): pergunta digitada, duas trilhas
 * (FTS5 BM25 + vetores FastEmbed) convergindo em RRF e corte para a tomada real.
 * `finale` troca o beat 3 (tomada real, f250+) por outro conteúdo: a versão
 * 100% motion passa ali o widget de evidências redesenhado.
 */
export const Scene4_Search: React.FC<{ finale?: React.ReactNode }> = ({ finale }) => {
  const frame = useCurrentFrame();

  // Beat 1 (f0–90): card da pergunta + digitação caractere a caractere (f10–80).
  const questionIn = enterUp(frame, 4, 18, 16);
  const typeProgress = interpolate(frame, [10, 80], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const typedCount = Math.floor(typeProgress * QUESTION.length);
  const typedText = QUESTION.slice(0, typedCount);
  const isTyping = frame >= 10 && frame < 80;
  const cursorVisible = isTyping && Math.floor((frame - 10) / 14) % 2 === 0;

  // Beat 2 (f90–240): trilhas, tags, conectores e nó RRF.
  const track1In = enterUp(frame, 90, 22, 20);
  const track2In = enterUp(frame, 96, 22, 20);
  const vecTagIn = enterUp(frame, 155, 20, 12);

  const lineDraw = progress(frame, 190, 22, EASE_OUT);
  const pulseT = progress(frame, 196, 30, EASE_IN_OUT);
  const pulseActive = frame >= 196 && frame <= 228;
  const pulseOpacity =
    interpolate(frame, [196, 202, 222, 228], [0, 1, 1, 0], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });

  const rrfIn = enterUp(frame, 190, 18, 14);
  const rrfShift = progress(frame, 220, 14, EASE_IN_OUT);
  const rrfColor = interpolateColors(rrfShift, [0, 1], [COLORS.amber, COLORS.emerald]);
  const rrfBorder = interpolateColors(
    rrfShift,
    [0, 1],
    [withAlpha(COLORS.amber, 0.5), withAlpha(COLORS.emerald, 0.55)],
  );
  const rrfBg = interpolateColors(
    rrfShift,
    [0, 1],
    [withAlpha(COLORS.amber, 0.12), withAlpha(COLORS.emerald, 0.14)],
  );

  // Beat 3 (f240–390): saída do diagrama (f240–262) e entrada da tomada real (f250–280).
  const diagramOut = progress(frame, 240, 22, EASE_IN);
  const diagramOpacity = 1 - diagramOut;
  const diagramTranslate = `0px ${-28 * diagramOut}px`;

  const clipIn = progress(frame, 250, 30, EASE_OUT);
  const clipScale = 0.96 + 0.04 * clipIn;
  const labelIn = enterUp(frame, 250, 22, 12);

  return (
    <SceneShell
      kicker="Busca híbrida · RRF"
      headline="Agora ele busca dentro do texto."
      why="O v1 só via as reviews mais votadas. O tema certo podia estar fora delas."
      whyFrom={200}
    >
      <div style={{ position: 'relative', width: CONTENT.width, height: CONTENT.height }}>
        {/* Beats 1 e 2: pergunta + trilhas + nó RRF */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            paddingTop: 18,
            boxSizing: 'border-box',
            opacity: diagramOpacity,
            translate: diagramTranslate,
          }}
        >
          {/* Card da pergunta */}
          <Card
            borderColor={isTyping ? withAlpha(COLORS.amber, 0.4) : COLORS.border}
            style={{
              width: CONTENT.width,
              padding: '22px 28px',
              ...questionIn,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 30,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  color: COLORS.amber,
                  flexShrink: 0,
                }}
              >
                ›
              </span>
              <div
                style={{
                  position: 'relative',
                  flex: 1,
                  fontFamily: FONTS.mono,
                  fontSize: 30,
                  fontWeight: 500,
                  lineHeight: 1.35,
                  color: COLORS.text,
                }}
              >
                {/* Reserva o tamanho final da pergunta para evitar pulos ao digitar */}
                <span style={{ visibility: 'hidden' }} aria-hidden>
                  {QUESTION}
                </span>
                <span style={{ position: 'absolute', inset: 0 }}>
                  {typedText}
                  {cursorVisible ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 3,
                        height: 30,
                        backgroundColor: COLORS.amber,
                        marginLeft: 3,
                        verticalAlign: 'text-bottom',
                      }}
                    />
                  ) : null}
                </span>
              </div>
            </div>
          </Card>

          {/* Trilhas empilhadas + linhas convergentes + nó RRF */}
          <div
            style={{
              position: 'relative',
              width: CONTENT.width,
              height: 530,
              marginTop: 22,
            }}
          >
            {/* Linhas finas e pulsos até o nó RRF */}
            <svg
              width={CONTENT.width}
              height={530}
              viewBox={`0 0 ${CONTENT.width} 530`}
              style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
            >
              <path
                d={PATH_RIGHT_FROM_TRACK1}
                fill="none"
                stroke={withAlpha(COLORS.amber, 0.45)}
                strokeWidth={1.5}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - lineDraw}
              />
              <path
                d={PATH_LEFT_FROM_TRACK2}
                fill="none"
                stroke={withAlpha(COLORS.emerald, 0.45)}
                strokeWidth={1.5}
                pathLength={1}
                strokeDasharray="1"
                strokeDashoffset={1 - lineDraw}
              />

              {pulseActive ? (
                <>
                  <path
                    d={PATH_RIGHT_FROM_TRACK1}
                    fill="none"
                    stroke={COLORS.amber}
                    strokeWidth={3}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.1 2"
                    strokeDashoffset={0.1 - pulseT * 1.1}
                    opacity={pulseOpacity}
                  />
                  <path
                    d={PATH_LEFT_FROM_TRACK2}
                    fill="none"
                    stroke={COLORS.emerald}
                    strokeWidth={3}
                    strokeLinecap="round"
                    pathLength={1}
                    strokeDasharray="0.1 2"
                    strokeDashoffset={0.1 - pulseT * 1.1}
                    opacity={pulseOpacity}
                  />
                </>
              ) : null}
            </svg>

            {/* Trilha 1: Palavra exata (FTS5 · BM25) */}
            <Card
              style={{
                position: 'absolute',
                left: TRACK_X,
                top: TRACK1_TOP,
                width: TRACK_W,
                height: TRACK1_H,
                padding: '22px 28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                ...track1In,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 20,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: COLORS.text,
                    }}
                  >
                    Palavra exata
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: TYPE.small,
                      lineHeight: 1.25,
                      color: COLORS.textMuted,
                      marginTop: 6,
                    }}
                  >
                    FTS5 · BM25
                  </div>
                </div>

                <Counter
                  from={0}
                  to={998533}
                  start={100}
                  duration={70}
                  suffix=" reviews"
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: TYPE.label,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: COLORS.amber,
                    whiteSpace: 'nowrap',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {KEYWORDS.map((kw, idx) => {
                  const tagIn = enterUp(frame, 150 + idx * 12, 16, 12);
                  return (
                    <Tag key={kw} tone="amber" shape="tag" fontSize={TYPE.small} style={tagIn}>
                      {kw}
                    </Tag>
                  );
                })}
              </div>
            </Card>

            {/* Trilha 2: Significado (vetores locais · FastEmbed) */}
            <Card
              style={{
                position: 'absolute',
                left: TRACK_X,
                top: TRACK2_TOP,
                width: TRACK_W,
                height: TRACK2_H,
                padding: '22px 28px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                ...track2In,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 30,
                      fontWeight: 600,
                      lineHeight: 1.2,
                      color: COLORS.text,
                    }}
                  >
                    Significado
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: TYPE.small,
                      lineHeight: 1.25,
                      color: COLORS.textMuted,
                      marginTop: 6,
                    }}
                  >
                    vetores locais · FastEmbed
                  </div>
                </div>

                <Counter
                  from={0}
                  to={11881}
                  start={110}
                  duration={60}
                  suffix=" reviews amostradas"
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 26,
                    fontWeight: 600,
                    lineHeight: 1.25,
                    color: COLORS.emerald,
                    whiteSpace: 'nowrap',
                  }}
                />
              </div>

              <div>
                <Tag tone="emerald" shape="pill" fontSize={TYPE.small} style={vecTagIn}>
                  embedding local · $0
                </Tag>
              </div>
            </Card>

            {/* Nó RRF centralizado abaixo das duas trilhas */}
            <div
              style={{
                position: 'absolute',
                left: RRF_CENTER_X,
                top: RRF_CENTER_Y,
                translate: '-50% -50%',
              }}
            >
              <div
                style={{
                  backgroundColor: COLORS.bg,
                  borderRadius: 999,
                  ...rrfIn,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 30px',
                    borderRadius: 999,
                    border: `1px solid ${rrfBorder}`,
                    backgroundColor: rrfBg,
                    color: rrfColor,
                    fontFamily: FONTS.mono,
                    fontSize: TYPE.label,
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  RRF
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Beat 3: tomada real com rótulo acima (ou o `finale` da versão motion) */}
        {finale ?? (
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 20,
              width: CONTENT.width,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: TYPE.small,
                lineHeight: 1.2,
                color: COLORS.textMuted,
                ...labelIn,
              }}
            >
              resposta real · trechos citados
            </div>
            <div
              style={{
                opacity: clipIn,
                scale: clipScale,
                transformOrigin: '50% 45%',
              }}
            >
              <ChatClip
                take="search"
                at="widget"
                offset={-0.45}
                startAtFrame={250}
                camera={[
                  { frame: 0, x: 1500, y: 372, w: 420 },
                  { frame: 50, x: 1500, y: 372, w: 420 },
                  { frame: 135, x: 1500, y: 500, w: 420 },
                ]}
                width={936}
                height={660}
              />
            </div>
          </div>
        )}
      </div>
    </SceneShell>
  );
};
