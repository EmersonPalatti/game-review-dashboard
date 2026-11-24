import React from 'react';
import { useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { BotBubble, ChipRow, ComparisonCard, MockPanel, StepState, ToolTimeline, UserBubble } from '../mock/ChatMock';
import { COMPARE } from '../mock/data';
import { CONTENT, EASE_IN_OUT } from '../tokens';

/** Quando cada ferramenta entra e termina (frames da cena). Ordem e tempos relativos da tomada T2. */
const STEP_TIMES = [
  { appear: 40, done: 60 },
  { appear: 48, done: 62 },
  { appear: 72, done: 104 },
  { appear: 78, done: 88 },
];
const COLLAPSE_FROM = 112;
const WIDGET_FROM = 122;
const CHIP_FROM = 166;

/**
 * Cena 0 · Gancho (240 frames). O resultado antes da explicação, já redesenhado
 * em motion: a pergunta, as ferramentas MCP fechando com os tempos reais, o
 * widget comparativo e o chip de filtro.
 */
export const M0_Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const panelIn = enterUp(frame, 0, 24, 22);
  const askIn = progress(frame, 12, 22);
  const bubbleIn = enterUp(frame, 32, 20, 14);

  const steps = COMPARE.steps.map((s, i) => {
    const t = STEP_TIMES[i];
    const state: StepState = frame < t.appear ? 'hidden' : frame < t.done ? 'running' : 'done';
    return { label: s.label, meta: s.meta, ms: s.ms, state, appear: progress(frame, t.appear, 12) };
  });
  const anyRunning = steps.some((s) => s.state === 'running');
  const collapse = progress(frame, COLLAPSE_FROM, 20, EASE_IN_OUT);

  const widgetIn = progress(frame, WIDGET_FROM, 22);
  const widgetCount = progress(frame, WIDGET_FROM + 6, 40, EASE_IN_OUT);
  const chipIn = progress(frame, CHIP_FROM, 20);

  return (
    <SceneShell kicker="SteamBot-9000 · v1 → v2" headline="Reconstruímos o chat do dashboard.">
      <div style={panelIn}>
        <MockPanel version="v2" width={CONTENT.width} height={CONTENT.height}>
          <div style={{ padding: 26, display: 'flex', flexDirection: 'column', gap: 22 }}>
            <UserBubble
              text={COMPARE.question}
              style={{ opacity: askIn, translate: `${(1 - askIn) * 40}px 0px` }}
            />
            <BotBubble style={{ ...bubbleIn, width: '100%' }}>
              <ToolTimeline
                steps={steps}
                frame={frame}
                liveLabel={anyRunning ? 'Consultando MCP + SQLite...' : 'Sintetizando análise...'}
                collapse={collapse}
                summary={`${COMPARE.steps.length} consultas MCP · ${COMPARE.totalToolMs} ms`}
              />
              {widgetIn > 0 ? (
                <ComparisonCard
                  title={COMPARE.widget.title}
                  delta={COMPARE.widget.delta}
                  a={COMPARE.widget.a}
                  b={COMPARE.widget.b}
                  count={widgetCount}
                  style={{ opacity: widgetIn, translate: `0px ${(1 - widgetIn) * 18}px` }}
                />
              ) : null}
              {chipIn > 0 ? (
                <ChipRow label={COMPARE.chip} style={{ opacity: chipIn, translate: `0px ${(1 - chipIn) * 12}px` }} />
              ) : null}
            </BotBubble>
          </div>
        </MockPanel>
      </div>
    </SceneShell>
  );
};
