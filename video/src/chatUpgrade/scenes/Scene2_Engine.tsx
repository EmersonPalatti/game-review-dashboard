import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Card } from '../components/Card';
import { Counter } from '../components/Counter';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { COLORS, EASE_IN_OUT, EASE_OUT, FONTS, CONTENT, withAlpha } from '../tokens';

interface ModelSpec {
  id: string;
  role: string;
}

const MODELS: readonly ModelSpec[] = [
  { id: 'nvidia/nemotron-3.5-super-vl:free', role: 'principal' },
  { id: 'inclusionai/ling-3.2-flash:free', role: 'fallback 1' },
  { id: 'nvidia/nemotron-3.5-lightning:free', role: 'fallback 2' },
  { id: 'openrouter/free', role: 'fallback 3' },
];

const MIDDLEWARES: readonly string[] = [
  'Fallback',
  'Retry',
  'Limite de 8 tools',
  'Erro de tool',
  'Resumo de contexto',
];

const LEFT_COL_WIDTH = 628;
const RAIL_X = 12;
const CARD_LEFT = 32;
const CARD_WIDTH = LEFT_COL_WIDTH - CARD_LEFT; // 596
const CARD_HEIGHT = 104;
const CARD_GAP = 16;

const RIGHT_COL_LEFT = 656;
const RIGHT_COL_WIDTH = CONTENT.width - RIGHT_COL_LEFT; // 280

function cardCenterY(index: number): number {
  return index * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2;
}

function mixHex(fromHex: string, toHex: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const parse = (hex: string) => {
    const clean = hex.replace('#', '');
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  };
  const [r1, g1, b1] = parse(fromHex);
  const [r2, g2, b2] = parse(toHex);
  const r = Math.round(r1 + (r2 - r1) * clamped);
  const g = Math.round(g1 + (g2 - g1) * clamped);
  const b = Math.round(b1 + (b2 - b1) * clamped);
  return `rgb(${r}, ${g}, ${b})`;
}

export const Scene2_Engine: React.FC = () => {
  const frame = useCurrentFrame();

  const y1 = cardCenterY(0);
  const y2 = cardCenterY(1);
  const y4 = cardCenterY(3);

  // Trilho vertical entra junto com os cartões (f20–60)
  const railGrow = progress(frame, 20, 38, EASE_OUT);
  const railVisibleBottom = y1 + (y4 - y1) * railGrow;

  // Pulso âmbar:
  // f70–100: desce do topo do trilho até o cartão 1
  // f110–150: desvia do cartão 1 e segue até o cartão 2
  const pulseFadeIn = progress(frame, 68, 6, EASE_OUT);
  const pulseFadeOut = 1 - progress(frame, 148, 8, EASE_OUT);
  const pulseOpacity = Math.min(pulseFadeIn, pulseFadeOut);

  let pulseX = RAIL_X;
  let pulseY = 0;

  if (frame < 105) {
    const p1 = progress(frame, 70, 22, EASE_IN_OUT);
    const pBranch1 = progress(frame, 92, 8, EASE_OUT);
    pulseX = RAIL_X + (CARD_LEFT - RAIL_X) * pBranch1;
    pulseY = interpolate(p1, [0, 1], [8, y1]);
  } else {
    const pLeave1 = progress(frame, 110, 8, EASE_OUT);
    const pDown = progress(frame, 118, 22, EASE_IN_OUT);
    const pBranch2 = progress(frame, 140, 10, EASE_OUT);
    if (frame < 118) {
      pulseX = CARD_LEFT - (CARD_LEFT - RAIL_X) * pLeave1;
      pulseY = y1;
    } else if (frame < 140) {
      pulseX = RAIL_X;
      pulseY = y1 + (y2 - y1) * pDown;
    } else {
      pulseX = RAIL_X + (CARD_LEFT - RAIL_X) * pBranch2;
      pulseY = y2;
    }
  }

  // Estados dos cartões
  const failProgress = progress(frame, 100, 8, EASE_OUT);
  const passProgress = progress(frame, 150, 8, EASE_OUT);
  const reserveDim = progress(frame, 146, 16, EASE_OUT);

  // Segmento ativo do trilho entre cartão 1 e cartão 2 durante o desvio
  const detourTrailProgress = progress(frame, 118, 24, EASE_IN_OUT);
  const detourGlowFade = 1 - progress(frame, 150, 14, EASE_OUT);

  // Coluna da direita: max_tokens + $0 de API
  const tokensIn = enterUp(frame, 154, 18, 16);
  const freePillIn = enterUp(frame, 200, 20, 16);

  // Parte de baixo: 5 middlewares
  const mwLabelIn = enterUp(frame, 184, 18, 12);

  return (
    <SceneShell
      kicker="LangChain v1 · create_agent"
      headline="Se um modelo cai, o próximo assume."
      why="Modelo de raciocínio gasta token pensando. Com 900, a resposta podia sair cortada."
      whyFrom={200}
    >
      {/* Parte de cima (y 0–470): coluna esquerda (trilho + 4 modelos) e coluna direita (max_tokens) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: CONTENT.width,
          height: 470,
        }}
      >
        {/* Trilho vertical e pulso âmbar */}
        <svg
          width={CARD_LEFT + 6}
          height={470}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {/* Linha principal do trilho */}
          <line
            x1={RAIL_X}
            y1={8}
            x2={RAIL_X}
            y2={Math.max(8, railVisibleBottom)}
            stroke={COLORS.borderLight}
            strokeWidth={1.5}
          />

          {/* Ramos horizontais para cada cartão */}
          {MODELS.map((_, idx) => {
            const cy = cardCenterY(idx);
            const branchIn = progress(frame, 20 + idx * 8, 16, EASE_OUT);
            const isFail = idx === 0 && failProgress > 0;
            const isPass = idx === 1 && passProgress > 0;
            const branchStroke = isPass
              ? COLORS.emerald
              : isFail
                ? withAlpha(COLORS.red, 0.7)
                : COLORS.borderLight;
            const nodeFill = isPass
              ? COLORS.emerald
              : isFail
                ? COLORS.red
                : COLORS.raised;

            return (
              <g key={idx} opacity={branchIn}>
                <line
                  x1={RAIL_X}
                  y1={cy}
                  x2={CARD_LEFT}
                  y2={cy}
                  stroke={branchStroke}
                  strokeWidth={1.5}
                />
                <circle
                  cx={RAIL_X}
                  cy={cy}
                  r={4.5}
                  fill={nodeFill}
                  stroke={branchStroke}
                  strokeWidth={1.5}
                />
              </g>
            );
          })}

          {/* Trilha âmbar do desvio entre o cartão 1 e o cartão 2 */}
          {detourTrailProgress > 0 && detourGlowFade > 0 ? (
            <line
              x1={RAIL_X}
              y1={y1}
              x2={RAIL_X}
              y2={y1 + (y2 - y1) * detourTrailProgress}
              stroke={COLORS.amber}
              strokeWidth={2}
              opacity={detourGlowFade * 0.85}
            />
          ) : null}

          {/* Pulso âmbar com leve brilho */}
          {pulseOpacity > 0 ? (
            <g opacity={pulseOpacity}>
              <circle
                cx={pulseX}
                cy={pulseY}
                r={14}
                fill={withAlpha(COLORS.amber, 0.24)}
              />
              <circle cx={pulseX} cy={pulseY} r={6} fill={COLORS.amber} />
            </g>
          ) : null}
        </svg>

        {/* 4 cartões de modelo empilhados */}
        {MODELS.map((model, idx) => {
          const entry = enterUp(frame, 20 + idx * 8, 16, 18);
          const top = idx * (CARD_HEIGHT + CARD_GAP);

          const isCard1 = idx === 0;
          const isCard2 = idx === 1;
          const isReserve = idx >= 2;

          let borderColor: string = COLORS.border;
          let bgColor: string = COLORS.surface;
          if (isCard1 && failProgress > 0) {
            borderColor = mixHex(COLORS.textMuted, COLORS.red, failProgress);
            bgColor = withAlpha(COLORS.red, 0.05 * failProgress);
          } else if (isCard2 && passProgress > 0) {
            borderColor = mixHex(COLORS.textMuted, COLORS.emerald, passProgress);
            bgColor = withAlpha(COLORS.emerald, 0.05 * passProgress);
          }

          const targetOpacity = isReserve
            ? 1 - 0.45 * reserveDim
            : isCard1
              ? 1 - 0.1 * failProgress
              : 1;

          const badge429In = isCard1 ? progress(frame, 100, 12, EASE_OUT) : 0;
          const badge200In = isCard2 ? progress(frame, 150, 12, EASE_OUT) : 0;

          return (
            <Card
              key={model.id}
              borderColor={borderColor}
              style={{
                position: 'absolute',
                left: CARD_LEFT,
                top,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                padding: '16px 22px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                backgroundColor:
                  isCard1 && failProgress > 0
                    ? bgColor
                    : isCard2 && passProgress > 0
                      ? bgColor
                      : COLORS.surface,
                opacity: entry.opacity * targetOpacity,
                translate: entry.translate,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 26,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  color: COLORS.text,
                  whiteSpace: 'nowrap',
                }}
              >
                {model.id}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  minHeight: 36,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 24,
                    lineHeight: 1.2,
                    color: COLORS.textMuted,
                  }}
                >
                  {model.role}
                </span>

                {isCard1 && badge429In > 0 ? (
                  <Tag
                    tone="red"
                    fontSize={24}
                    style={{
                      padding: '4px 14px',
                      opacity: badge429In,
                      scale: String(0.9 + 0.1 * badge429In),
                    }}
                  >
                    429
                  </Tag>
                ) : null}

                {isCard2 && badge200In > 0 ? (
                  <Tag
                    tone="emerald"
                    solid
                    fontSize={24}
                    style={{
                      padding: '4px 14px',
                      opacity: badge200In,
                      scale: String(0.9 + 0.1 * badge200In),
                    }}
                  >
                    200 OK
                  </Tag>
                ) : null}
              </div>
            </Card>
          );
        })}

        {/* Coluna da direita: max_tokens + $0 de API */}
        <div
          style={{
            position: 'absolute',
            left: RIGHT_COL_LEFT,
            top: 0,
            width: RIGHT_COL_WIDTH,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
          }}
        >
          <Card
            style={{
              width: RIGHT_COL_WIDTH,
              padding: '24px 24px 26px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              ...tokensIn,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 24,
                lineHeight: 1.2,
                color: COLORS.textMuted,
              }}
            >
              max_tokens
            </div>
            <Counter
              from={900}
              to={2048}
              start={170}
              duration={50}
              style={{
                fontFamily: FONTS.mono,
                fontSize: 72,
                fontWeight: 600,
                lineHeight: 1.05,
                letterSpacing: '-0.03em',
                color: COLORS.emerald,
              }}
            />
          </Card>

          <div
            style={{
              marginTop: 20,
              ...freePillIn,
            }}
          >
            <Tag tone="emerald" shape="pill" fontSize={26}>
              $0 de API
            </Tag>
          </div>
        </div>
      </div>

      {/* Parte de baixo (y 520–750): 5 middlewares */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 520,
          width: CONTENT.width,
          height: 230,
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
        }}
      >
        <div
          style={{
            height: 1,
            width: '100%',
            backgroundColor: COLORS.border,
            opacity: mwLabelIn.opacity,
          }}
        />
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 24,
            lineHeight: 1.2,
            color: COLORS.textMuted,
            ...mwLabelIn,
          }}
        >
          5 middlewares
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '14px 14px',
            maxWidth: 780,
          }}
        >
          {MIDDLEWARES.map((name, idx) => {
            const chipIn = enterUp(frame, 190 + idx * 8, 18, 14);
            return (
              <Tag
                key={name}
                tone="neutral"
                shape="pill"
                fontSize={26}
                style={{
                  ...chipIn,
                }}
              >
                {name}
              </Tag>
            );
          })}
        </div>
      </div>
    </SceneShell>
  );
};
