import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import { enterUp, formatInt, progress } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import type { SfxEvent } from '../ChatUpgradeAudio';
import {
  ArrowCursor,
  BotBubble,
  ChipRow,
  ComparisonCard,
  MOCK,
  MockPanel,
  StepState,
  StreamText,
  ToolTimeline,
  UserBubble,
  formatPct,
  timelineOpenHeight,
} from '../mock/ChatMock';
import { COMPARE } from '../mock/data';
import { COLORS, CONTENT, EASE_IN_OUT, EASE_OUT, FONTS, withAlpha } from '../tokens';

/* ───────────────────────────── linha do tempo ───────────────────────────── */

/**
 * Eventos AG-UI da tomada T2, na ordem real do stream (capture/fixtures/compare.stream.json).
 * Os frames comprimem os 19,2 s da execução; os ms mostrados são os tool_timing reais.
 */
type Target = 'header' | 'row0' | 'row1' | 'rows01' | 'row2' | 'row3' | 'chip' | 'widget' | 'text' | 'summary';
type Tone = 'neutral' | 'amber' | 'emerald';

interface StreamEvent {
  frame: number;
  type: string;
  detail: string;
  tone: Tone;
  target: Target;
}

const EVENTS: StreamEvent[] = [
  { frame: 16, type: 'RUN_STARTED', detail: 'o agente começa', tone: 'neutral', target: 'header' },
  { frame: 40, type: 'TOOL_CALL_START', detail: 'resolve_game · Arma 3', tone: 'amber', target: 'row0' },
  { frame: 52, type: 'TOOL_CALL_START', detail: 'resolve_game · NieR', tone: 'amber', target: 'row1' },
  { frame: 76, type: 'TOOL_CALL_RESULT', detail: '2× resolve_game · 7 ms', tone: 'emerald', target: 'rows01' },
  { frame: 100, type: 'TOOL_CALL_START', detail: 'compare_slices', tone: 'amber', target: 'row2' },
  { frame: 110, type: 'TOOL_CALL_START', detail: 'propose_dashboard_actions', tone: 'amber', target: 'row3' },
  { frame: 126, type: 'CUSTOM', detail: 'dashboard_actions · chip', tone: 'emerald', target: 'chip' },
  { frame: 150, type: 'TOOL_CALL_RESULT', detail: 'compare_slices · 244 ms', tone: 'emerald', target: 'row2' },
  { frame: 162, type: 'CUSTOM', detail: 'genui_widget · comparison', tone: 'emerald', target: 'widget' },
  { frame: 224, type: 'TEXT_MESSAGE_CONTENT', detail: '×222 pedaços de texto', tone: 'emerald', target: 'text' },
  { frame: 322, type: 'RUN_FINISHED', detail: '4 consultas · 260 ms', tone: 'neutral', target: 'summary' },
];

const ev = (target: Target) => EVENTS.find((e) => e.target === target)!.frame;

/** Ferramentas: quando aparecem e quando terminam. */
const STEP_TIMES = [
  { appear: ev('row0'), done: ev('rows01') },
  { appear: ev('row1'), done: ev('rows01') },
  { appear: ev('row2'), done: 150 },
  { appear: ev('row3'), done: ev('chip') },
];
const TEXT_FROM = ev('text');
const TEXT_TO = 316;
const COLLAPSE_FROM = ev('summary');

/** Fase B: o clique no chip e o painel reagindo. */
const PHASE_B = 362;
const CLICK = 438;

export const M5_SFX: SfxEvent[] = [
  { name: 'widget na resposta', frame: ev('widget'), src: 'audio/tap.wav', volume: 0.25 },
  { name: 'chip de filtro', frame: CLICK, src: 'audio/click.wav', volume: 0.4 },
];

/* ───────────────────────────── medidas ───────────────────────────── */

const CALLOUT_H = 76;
const BODY_H = CONTENT.height - CALLOUT_H; // 674
const MOCK_W = 600;
const RAIL_X = 620;
const RAIL_W = CONTENT.width - RAIL_X; // 316

const PAD = 20;
const USER_H = 139;
const BUBBLE_PAD = 18;
const GAP = 16;
const TEXT_H = 104;
const WIDGET_H = 236;
const CHIP_H = 52;

const CALLOUTS = [
  { from: 6, to: TEXT_FROM - 4, text: 'ferramentas e tempos reais' },
  { from: TEXT_FROM - 4, to: PHASE_B, text: 'resposta em streaming' },
  { from: PHASE_B, to: 600, text: '1 clique no painel, com desfazer' },
];

const TONE: Record<Tone, string> = {
  neutral: COLORS.textSecondary,
  amber: COLORS.amber,
  emerald: COLORS.emerald,
};

/* ───────────────────────────── peças ───────────────────────────── */

const Callout: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...enterUp(frame, 0, 16, 10) }}>
      <Tag tone="emerald" shape="pill">
        {text}
      </Tag>
    </div>
  );
};

/** Anel que pisca em volta do elemento que um evento acabou de criar ou mudar. */
const FlashRing: React.FC<{ y: number; h: number; x?: number; w: number; t: number; tone: Tone }> = ({
  y,
  h,
  x = 0,
  w,
  t,
  tone,
}) => {
  if (t <= 0 || t >= 1) return null;
  const opacity = interpolate(t, [0, 0.15, 1], [0, 1, 0]);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 6,
        top: y - 4,
        width: w + 12,
        height: h + 8,
        borderRadius: 14,
        border: `2px solid ${TONE[tone]}`,
        boxShadow: `0 0 24px ${withAlpha(TONE[tone] === COLORS.textSecondary ? '#A1A1A6' : TONE[tone], 0.35)}`,
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};

const RAIL_HEAD_H = 52;
const RAIL_ROW_H = 74;

/** Coluna da direita: os eventos AG-UI chegando pelo stream (SSE). */
const EventRail: React.FC<{ frame: number }> = ({ frame }) => {
  const rows = EVENTS.map((e) => ({ ...e, reveal: progress(frame, e.frame, 14) }));
  const listH = rows.reduce((acc, r) => acc + RAIL_ROW_H * r.reveal, 0);
  const scroll = Math.max(0, RAIL_HEAD_H + listH - BODY_H);
  const textCount = Math.round(
    interpolate(frame, [TEXT_FROM, TEXT_TO], [1, COMPARE.textDeltas], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  return (
    <div style={{ position: 'absolute', left: RAIL_X, top: CALLOUT_H, width: RAIL_W, height: BODY_H, overflow: 'hidden' }}>
      <div
        style={{
          height: RAIL_HEAD_H,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          fontFamily: FONTS.mono,
          fontSize: 24,
          color: COLORS.textMuted,
          letterSpacing: '0.04em',
          borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.bg,
          position: 'relative',
          zIndex: 1,
        }}
      >
        eventos AG-UI
        <span
          style={{
            fontSize: 20,
            padding: '2px 8px',
            borderRadius: 6,
            border: `1px solid ${COLORS.borderLight}`,
            color: COLORS.textSecondary,
          }}
        >
          SSE
        </span>
      </div>
      <div
        style={{
          height: BODY_H - RAIL_HEAD_H,
          overflow: 'hidden',
          maskImage: scroll > 0 ? 'linear-gradient(to bottom, transparent 0px, black 56px)' : undefined,
        }}
      >
        <div style={{ translate: `0px ${-scroll}px` }}>
          {rows.map((r, i) => {
            if (r.reveal <= 0) return null;
            const age = frame - r.frame;
            const fresh = interpolate(age, [0, 6, 40], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
            const isLatest = rows.slice(i + 1).every((n) => n.reveal <= 0);
            const color = TONE[r.tone];
            const detail = r.target === 'text' ? `×${textCount} pedaços de texto` : r.detail;
            return (
              <div
                key={`${r.type}-${i}`}
                style={{
                  height: RAIL_ROW_H * r.reveal,
                  overflow: 'hidden',
                  opacity: r.reveal * (isLatest ? 1 : 0.5),
                }}
              >
                <div
                  style={{
                    marginTop: 10,
                    height: RAIL_ROW_H - 10,
                    paddingLeft: 14,
                    borderLeft: `3px solid ${color}`,
                    backgroundColor: withAlpha(r.tone === 'neutral' ? '#A1A1A6' : color, 0.04 + 0.12 * fresh),
                    borderRadius: '0 10px 10px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    gap: 2,
                    boxSizing: 'border-box',
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 24,
                      fontWeight: 500,
                      color,
                      lineHeight: 1.15,
                      whiteSpace: 'nowrap',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {r.type}
                  </span>
                  <span
                    style={{
                      fontSize: 24,
                      color: COLORS.textSecondary,
                      lineHeight: 1.15,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {detail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ───────────────────────────── fase A ───────────────────────────── */

/** Chat montado pelos eventos, com rolagem ancorada no fim como no app. */
const LiveChat: React.FC<{ frame: number }> = ({ frame }) => {
  const steps = COMPARE.steps.map((s, i) => {
    const t = STEP_TIMES[i];
    const state: StepState = frame < t.appear ? 'hidden' : frame < t.done ? 'running' : 'done';
    return { label: s.label, meta: s.meta, ms: s.ms, state, appear: progress(frame, t.appear, 12) };
  });
  const anyRunning = steps.some((s) => s.state === 'running');
  const collapse = progress(frame, COLLAPSE_FROM, 22, EASE_IN_OUT);

  // Alturas animadas: todo crescimento é contínuo, então a rolagem também é.
  const rowsShown = steps.reduce((acc, s) => acc + (s.state === 'hidden' ? 0 : Math.min(1, s.appear)), 0);
  const tlOpen = timelineOpenHeight(rowsShown);
  const tlH = tlOpen + (54 - tlOpen) * collapse;
  const bubbleIn = progress(frame, ev('header'), 16);
  const chipReveal = progress(frame, ev('chip'), 18);
  const widgetReveal = progress(frame, ev('widget'), 22);
  const textReveal = progress(frame, TEXT_FROM, 16);
  const textProgress = interpolate(frame, [TEXT_FROM + 4, TEXT_TO], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const tlY = PAD + USER_H + GAP + BUBBLE_PAD;
  const textBlock = (GAP + TEXT_H) * textReveal;
  const widgetBlock = (GAP + WIDGET_H) * widgetReveal;
  const chipBlock = (GAP + CHIP_H) * chipReveal;
  const textY = tlY + tlH + GAP;
  const widgetY = tlY + tlH + textBlock + GAP;
  const chipY = tlY + tlH + textBlock + widgetBlock + GAP;
  const bubbleH = BUBBLE_PAD * 2 + tlH + textBlock + widgetBlock + chipBlock;
  const contentH = PAD + USER_H + GAP + bubbleH * bubbleIn + PAD;
  const scroll = Math.max(0, contentH - BODY_H);

  // Posições dos alvos (no espaço do conteúdo) para os anéis.
  const innerX = PAD + BUBBLE_PAD;
  const innerW = MOCK_W - 2 * (PAD + BUBBLE_PAD);
  const rowY = (i: number) => tlY + 14 + 46 + i * MOCK.rowH;
  const targets: Record<Target, { y: number; h: number }> = {
    header: { y: tlY, h: 60 },
    row0: { y: rowY(0), h: MOCK.rowH },
    row1: { y: rowY(1), h: MOCK.rowH },
    rows01: { y: rowY(0), h: MOCK.rowH * 2 },
    row2: { y: rowY(2), h: MOCK.rowH },
    row3: { y: rowY(3), h: MOCK.rowH },
    chip: { y: chipY, h: CHIP_H },
    widget: { y: widgetY, h: WIDGET_H },
    text: { y: textY, h: TEXT_H },
    summary: { y: tlY, h: 54 },
  };

  return (
    <MockPanel version="v2" width={MOCK_W} height={BODY_H} showHeader={false}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, translate: `0px ${-scroll}px` }}>
        <div style={{ padding: PAD }}>
          <div style={{ height: USER_H }}>
            <UserBubble text={COMPARE.question} maxWidth="90%" />
          </div>
          <BotBubble style={{ marginTop: GAP, gap: 0, opacity: bubbleIn, padding: BUBBLE_PAD }}>
            <ToolTimeline
              steps={steps}
              frame={frame}
              liveLabel={anyRunning ? 'Consultando MCP + SQLite...' : 'Sintetizando análise...'}
              collapse={collapse}
              summary={`${COMPARE.steps.length} consultas MCP · ${COMPARE.totalToolMs} ms`}
            />
            <div style={{ height: textBlock, overflow: 'hidden' }}>
              <StreamText
                segments={COMPARE.answerLines}
                progress={textProgress}
                frame={frame}
                fontSize={24}
                style={{ marginTop: GAP, height: TEXT_H, opacity: textReveal }}
              />
            </div>
            <div style={{ height: widgetBlock, overflow: 'hidden' }}>
              <ComparisonCard
                compact
                title={COMPARE.widget.title}
                delta={COMPARE.widget.delta}
                a={COMPARE.widget.a}
                b={COMPARE.widget.b}
                count={progress(frame, ev('widget') + 6, 40, EASE_IN_OUT)}
                style={{ marginTop: GAP, height: WIDGET_H, opacity: widgetReveal }}
              />
            </div>
            <div style={{ height: chipBlock, overflow: 'hidden' }}>
              <ChipRow label={COMPARE.chip} style={{ marginTop: GAP, height: CHIP_H, opacity: chipReveal }} />
            </div>
          </BotBubble>
        </div>

        {EVENTS.map((e) => {
          const t = interpolate(frame, [e.frame, e.frame + 34], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const target = targets[e.target];
          return <FlashRing key={`${e.type}-${e.frame}`} x={innerX} w={innerW} y={target.y} h={target.h} t={t} tone={e.tone} />;
        })}
      </div>
    </MockPanel>
  );
};

/* ───────────────────────────── fase B ───────────────────────────── */

const SLICE_H = 112;
const DASH_TOP = SLICE_H + 64;
const KPI_GAP = 16;

function formatKpi(value: number, format: 'int' | 'pct'): string {
  return format === 'pct' ? formatPct(value) : formatInt(value);
}

/** O chip clicado e o painel mudando no mesmo instante. */
const ClickAndPanel: React.FC<{ frame: number }> = ({ frame }) => {
  const press = interpolate(frame, [CLICK - 2, CLICK + 3, CLICK + 9], [1, 0.95, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const active = progress(frame, CLICK + 4, 14);
  const undo = progress(frame, CLICK + 16, 16);
  const change = progress(frame, CLICK + 8, 60, EASE_IN_OUT);
  const swap = progress(frame, CLICK + 8, 16);
  const ring = interpolate(frame, [CLICK + 8, CLICK + 16, CLICK + 70], [0, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor: entra pela direita, vai ao chip, clica e depois para sobre o Desfazer.
  const CHIP_AT = { x: 330, y: 64 };
  const UNDO_AT = { x: 610, y: 66 };
  const toChip = progress(frame, 386, 46, EASE_IN_OUT);
  const toUndo = progress(frame, 500, 34, EASE_IN_OUT);
  const cursorX = interpolate(toChip, [0, 1], [760, CHIP_AT.x]) + (UNDO_AT.x - CHIP_AT.x) * toUndo;
  const cursorY = interpolate(toChip, [0, 1], [420, CHIP_AT.y]) + (UNDO_AT.y - CHIP_AT.y) * toUndo;
  const cursorIn = progress(frame, 382, 12);
  const tooltip = progress(frame, 536, 14);
  const ripple = frame >= CLICK && frame < CLICK + 24 ? (frame - CLICK) / 24 : null;

  const labelIn = enterUp(frame, PHASE_B + 14, 20, 10);
  const kpiW = (CONTENT.width - 2 * 22 - KPI_GAP) / 2;

  return (
    <div style={{ position: 'absolute', left: 0, top: CALLOUT_H, width: CONTENT.width, height: BODY_H }}>
      {/* Fim da bolha do chat: o chip sugerido pelo agente */}
      <MockPanel version="v2" width={CONTENT.width} height={SLICE_H} showHeader={false}>
        <div style={{ position: 'absolute', left: 28, top: 0, height: SLICE_H, display: 'flex', alignItems: 'center' }}>
          <ChipRow label={COMPARE.chip} active={active} undo={undo} press={press} />
        </div>
      </MockPanel>

      <div
        style={{
          position: 'absolute',
          left: 0,
          top: SLICE_H + 18,
          fontFamily: FONTS.mono,
          fontSize: 24,
          color: COLORS.textMuted,
          ...labelIn,
          opacity: labelIn.opacity * (1 - tooltip),
        }}
      >
        o painel, no mesmo instante
      </div>

      {/* Painel: faixa de filtro + 4 KPIs */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: DASH_TOP,
          width: CONTENT.width,
          height: BODY_H - DASH_TOP,
          borderRadius: MOCK.radius,
          border: `1px solid ${COLORS.borderLight}`,
          backgroundColor: COLORS.surface,
          padding: 22,
          boxSizing: 'border-box',
          ...enterUp(frame, PHASE_B + 18, 22, 16),
        }}
      >
        <div style={{ position: 'relative', height: 48 }}>
          <div
            style={{
              position: 'absolute',
              left: 4,
              top: 0,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              fontSize: 24,
              color: COLORS.textMuted,
              opacity: 1 - swap,
            }}
          >
            {COMPARE.noFilterLabel}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 18px',
              borderRadius: 10,
              backgroundColor: MOCK.wellBg,
              border: `1px solid ${withAlpha(COLORS.emerald, 0.25 + 0.5 * ring)}`,
              fontSize: 24,
              color: COLORS.textSecondary,
              opacity: swap,
              translate: `0px ${(1 - swap) * 8}px`,
              whiteSpace: 'nowrap',
            }}
          >
            Jogo: <span style={{ color: COLORS.text, fontWeight: 600 }}>{COMPARE.filterValue}</span>
            <span style={{ color: COLORS.textMuted }}>×</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `${kpiW}px ${kpiW}px`, gap: KPI_GAP, marginTop: 18 }}>
          {COMPARE.kpis.map((k, i) => {
            const value = k.from + (k.to - k.from) * change;
            return (
              <div
                key={k.label}
                style={{
                  height: 176,
                  borderRadius: 14,
                  backgroundColor: MOCK.wellBg,
                  padding: '18px 22px',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: `inset 0 0 0 ${1 + ring}px ${withAlpha(COLORS.emerald, 0.6 * ring)}`,
                  ...enterUp(frame, PHASE_B + 24 + i * 5, 20, 12),
                }}
              >
                <span style={{ fontSize: 24, color: COLORS.textSecondary }}>{k.label}</span>
                <span
                  style={{
                    fontSize: 54,
                    fontWeight: 600,
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                    color: k.format === 'pct' ? COLORS.emerald : COLORS.text,
                  }}
                >
                  {formatKpi(value, k.format)}
                </span>
                <div style={{ position: 'relative', height: 30, fontSize: 24, color: COLORS.textMuted, whiteSpace: 'nowrap' }}>
                  <span style={{ position: 'absolute', left: 0, top: 0, opacity: 1 - swap }}>{k.fromSub}</span>
                  <span style={{ position: 'absolute', left: 0, top: 0, opacity: swap }}>{k.toSub}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tooltip real do botão Desfazer */}
      <div
        style={{
          position: 'absolute',
          left: 300,
          top: SLICE_H + 8,
          padding: '10px 16px',
          borderRadius: 10,
          backgroundColor: '#26262B',
          border: `1px solid ${COLORS.borderLight}`,
          fontSize: 24,
          color: COLORS.text,
          whiteSpace: 'nowrap',
          opacity: tooltip,
          translate: `0px ${(1 - tooltip) * 6}px`,
          boxShadow: '0 12px 28px rgba(0,0,0,0.55)',
        }}
      >
        {COMPARE.undoTitle}
      </div>

      {/* Cursor */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          transform: `translate(${cursorX}px, ${cursorY}px)`,
          opacity: cursorIn,
          pointerEvents: 'none',
        }}
      >
        {ripple !== null ? (
          <div
            style={{
              position: 'absolute',
              left: -36,
              top: -36,
              width: 72,
              height: 72,
              borderRadius: 999,
              border: `3px solid ${COLORS.emerald}`,
              opacity: 1 - ripple,
              scale: 0.4 + ripple * 0.9,
            }}
          />
        ) : null}
        <ArrowCursor pressed={frame >= CLICK - 2 && frame < CLICK + 6} size={38} />
      </div>
    </div>
  );
};

/* ───────────────────────────── cena ───────────────────────────── */

/**
 * Cena 5 · O agente trabalhando (600 frames), em motion.
 * Fase A (0–348): cada evento AG-UI do stream real aparece à direita e, no mesmo
 * instante, a peça que ele cria acende no chat à esquerda: ferramentas com os ms
 * reais, o chip, o widget, o texto em streaming e o resumo no fim.
 * Fase B (348–600): o clique no chip e os KPIs do painel mudando, com Desfazer.
 */
export const M5_Live: React.FC = () => {
  const frame = useCurrentFrame();
  const phaseB = progress(frame, PHASE_B, 18, EASE_OUT);

  return (
    <SceneShell
      kicker="AG-UI 1.0 · streaming"
      headline="Você vê o agente trabalhar."
      why="Sai o loading simulado. Entra o que de fato está acontecendo."
      whyFrom={30}
    >
      {CALLOUTS.map((c) => (
        <Sequence key={c.text} from={c.from} durationInFrames={c.to - c.from} layout="none">
          <Callout text={c.text} />
        </Sequence>
      ))}

      {phaseB < 1 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: 1 - phaseB }}>
          <div style={{ position: 'absolute', left: 0, top: CALLOUT_H, ...enterUp(frame, 0, 22, 18) }}>
            <LiveChat frame={frame} />
          </div>
          <EventRail frame={frame} />
        </div>
      ) : null}

      {phaseB > 0 ? (
        <div style={{ position: 'absolute', inset: 0, opacity: phaseB }}>
          <ClickAndPanel frame={frame} />
        </div>
      ) : null}
    </SceneShell>
  );
};
