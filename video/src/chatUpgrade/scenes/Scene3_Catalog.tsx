import React from 'react';
import { useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { Counter } from '../components/Counter';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { COLORS, CONTENT, EASE_IN_OUT, EASE_OUT, FONTS, withAlpha } from '../tokens';

const TOTAL_GAMES = 59;
const V1_GAMES = 10;
const GRID_COLS = 8;
const DOT_SIZE = 28;
const DOT_GAP = 22;
const DOT_PITCH = DOT_SIZE + DOT_GAP; // 50
const GRID_ROWS = Math.ceil(TOTAL_GAMES / GRID_COLS); // 8
const GRID_WIDTH = GRID_COLS * DOT_SIZE + (GRID_COLS - 1) * DOT_GAP; // 378
const GRID_HEIGHT = GRID_ROWS * DOT_SIZE + (GRID_ROWS - 1) * DOT_GAP; // 378

const EXISTING_TOOLS: readonly string[] = [
  'KPIs & Rankings',
  'Séries & Playtime',
  'Amostra de Reviews',
];

interface NewToolSpec {
  label: string;
  note?: string;
}

const NEW_TOOLS: readonly NewToolSpec[] = [
  { label: 'Catálogo (59 jogos)' },
  { label: 'Engajamento', note: 'negativas recebem 2,8× mais votos úteis' },
  { label: 'Comparativo A vs B', note: 'diferença em p.p. numa chamada só' },
  { label: 'Busca Híbrida (FTS5 + Vetor)' },
];

const FRAME_LEFT = 0;
const FRAME_TOP = 222;
const FRAME_WIDTH = CONTENT.width; // 936
const FRAME_HEIGHT = 434;

export const Scene3_Catalog: React.FC = () => {
  const frame = useCurrentFrame();

  // Beat 1 → Beat 2 transição (f150–184): bloco da grade e contador sobe e encolhe para o topo
  const shrinkT = progress(frame, 150, 34, EASE_IN_OUT);

  const gridTop = 128 * (1 - shrinkT);
  const gridScale = 1 - 0.54 * shrinkT; // 378 * 0.46 = ~174 px (cabe acima de y = 200)

  const counterLeft = 440 + (214 - 440) * shrinkT;
  const counterTop = 216 + (22 - 216) * shrinkT;
  const numberScale = 1 - 0.35 * shrinkT; // 120 * 0.65 = 78 px
  const numberHeight = 120 * numberScale;

  // Legenda vermelha (f20 a ~f100)
  const missingFadeIn = enterUp(frame, 20, 16, 10);
  const missingFadeOut = 1 - progress(frame, 90, 16, EASE_OUT);
  const missingOpacity = missingFadeIn.opacity * missingFadeOut;

  // Beat 2: ferramentas
  const existingLabelIn = enterUp(frame, 178, 16, 12);
  const newLabelIn = enterUp(frame, 202, 16, 12);

  // Moldura FastMCP se desenha em torno das 7 ferramentas (~f250)
  const frameDraw = progress(frame, 246, 28, EASE_IN_OUT);
  const frameTitleIn = enterUp(frame, 250, 16, 8);
  const bottomNoteIn = enterUp(frame, 270, 18, 12);

  // Perímetro aproximado do retângulo hairline para animação de traço contínuo
  const perimeter = 2 * (FRAME_WIDTH + FRAME_HEIGHT);

  return (
    <SceneShell
      kicker="FastMCP · 7 ferramentas"
      headline="De 10 para 59 jogos."
      why="Fora do top 10, o v1 só achava o jogo se ele já estivesse filtrado no painel."
      whyFrom={170}
    >
      {/* Grade de 59 pontos (8 colunas, última linha com 3) */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: gridTop,
          width: GRID_WIDTH,
          height: GRID_HEIGHT,
          scale: String(gridScale),
          transformOrigin: 'top left',
        }}
      >
        {Array.from({ length: TOTAL_GAMES }).map((_, idx) => {
          const col = idx % GRID_COLS;
          const row = Math.floor(idx / GRID_COLS);
          const x = col * DOT_PITCH;
          const y = row * DOT_PITCH;
          const isV1 = idx < V1_GAMES;

          // Onda f70–130 (~1 frame por ponto)
          const waveStart = 70 + idx * 0.85;
          const waveP = progress(frame, waveStart, 10, EASE_OUT);
          const pulseScale =
            waveP > 0 && waveP < 1 ? 1 + 0.14 * Math.sin(waveP * Math.PI) : 1;

          let backgroundColor = 'transparent';
          let borderColor: string = COLORS.borderLight;

          if (waveP > 0) {
            backgroundColor =
              isV1 && waveP < 1
                ? COLORS.emerald
                : withAlpha(COLORS.emerald, isV1 ? 1 : waveP);
            borderColor = waveP >= 0.35 ? COLORS.emerald : COLORS.borderLight;
          } else if (isV1) {
            backgroundColor = COLORS.textSecondary;
            borderColor = COLORS.textSecondary;
          }

          return (
            <div
              key={idx}
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: 999,
                boxSizing: 'border-box',
                border: `1.5px solid ${borderColor}`,
                backgroundColor,
                scale: String(pulseScale),
              }}
            />
          );
        })}
      </div>

      {/* Legenda vermelha abaixo da grade (f20 a ~f100) */}
      {missingOpacity > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 128 + GRID_HEIGHT + 24,
            fontFamily: FONTS.mono,
            fontSize: 24,
            lineHeight: 1.2,
            color: COLORS.red,
            opacity: missingOpacity,
            translate: missingFadeIn.translate,
          }}
        >
          49 fora do alcance do v1
        </div>
      ) : null}

      {/* Contador 10 → 59 à direita da grade */}
      <div
        style={{
          position: 'absolute',
          left: counterLeft,
          top: counterTop,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            height: numberHeight,
            display: 'flex',
            alignItems: 'flex-start',
          }}
        >
          <Counter
            from={10}
            to={59}
            start={70}
            duration={60}
            style={{
              fontFamily: FONTS.mono,
              fontSize: 120,
              fontWeight: 600,
              lineHeight: 1,
              letterSpacing: '-0.04em',
              color: COLORS.emerald,
              scale: String(numberScale),
              transformOrigin: 'top left',
              display: 'inline-block',
            }}
          />
        </div>
        <div
          style={{
            marginTop: 14 - 4 * shrinkT,
            fontFamily: FONTS.sans,
            fontSize: 24,
            lineHeight: 1.25,
            color: COLORS.textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          jogos visíveis para o chat
        </div>
      </div>

      {/* Beat 2: Moldura hairline FastMCP + 7 ferramentas */}
      <svg
        width={FRAME_WIDTH}
        height={FRAME_HEIGHT}
        style={{
          position: 'absolute',
          left: FRAME_LEFT,
          top: FRAME_TOP,
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <rect
          x={0.5}
          y={0.5}
          width={FRAME_WIDTH - 1}
          height={FRAME_HEIGHT - 1}
          rx={16}
          ry={16}
          fill="none"
          stroke={COLORS.borderLight}
          strokeWidth={1}
          strokeDasharray={perimeter}
          strokeDashoffset={perimeter * (1 - frameDraw)}
          opacity={frameDraw > 0 ? 1 : 0}
        />
      </svg>

      {/* Rótulo encostado na borda superior da moldura */}
      {frameTitleIn.opacity > 0.01 ? (
        <div
          style={{
            position: 'absolute',
            left: FRAME_LEFT + 24,
            top: FRAME_TOP - 15,
            padding: '0 12px',
            backgroundColor: COLORS.bg,
            fontFamily: FONTS.mono,
            fontSize: 24,
            lineHeight: 1.2,
            color: COLORS.textSecondary,
            ...frameTitleIn,
          }}
        >
          FastMCP · SteamReviewsAnalytics
        </div>
      ) : null}

      {/* Conteúdo das 7 ferramentas dentro da moldura */}
      <div
        style={{
          position: 'absolute',
          left: FRAME_LEFT + 28,
          top: FRAME_TOP + 34,
          width: FRAME_WIDTH - 56,
          display: 'flex',
          flexDirection: 'column',
          gap: 22,
        }}
      >
        {/* Já existiam (3 neutral com opacidade reduzida) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              lineHeight: 1.2,
              color: COLORS.textMuted,
              ...existingLabelIn,
            }}
          >
            já existiam
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '10px 12px',
            }}
          >
            {EXISTING_TOOLS.map((tool, idx) => {
              const itemIn = enterUp(frame, 182 + idx * 6, 16, 12);
              return (
                <Tag
                  key={tool}
                  tone="neutral"
                  fontSize={24}
                  style={{
                    padding: '8px 16px',
                    opacity: itemIn.opacity * 0.68,
                    translate: itemIn.translate,
                  }}
                >
                  {tool}
                </Tag>
              );
            })}
          </div>
        </div>

        {/* Novas (4 emerald + notas curtas) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 24,
              lineHeight: 1.2,
              color: COLORS.emerald,
              ...newLabelIn,
            }}
          >
            novas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NEW_TOOLS.map((tool, idx) => {
              const itemIn = enterUp(frame, 208 + idx * 8, 16, 12);
              return (
                <div
                  key={tool.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    ...itemIn,
                  }}
                >
                  <Tag
                    tone="emerald"
                    fontSize={24}
                    style={{
                      padding: '8px 16px',
                    }}
                  >
                    {tool.label}
                  </Tag>
                  {tool.note ? (
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 24,
                        lineHeight: 1.2,
                        color: COLORS.textSecondary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {tool.note}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Nota abaixo da moldura (~f270) */}
      <div
        style={{
          position: 'absolute',
          left: FRAME_LEFT,
          top: FRAME_TOP + FRAME_HEIGHT + 22,
          fontFamily: FONTS.sans,
          fontSize: 24,
          lineHeight: 1.25,
          color: COLORS.textMuted,
          ...bottomNoteIn,
        }}
      >
        o mesmo servidor atende outros clientes MCP
      </div>
    </SceneShell>
  );
};
