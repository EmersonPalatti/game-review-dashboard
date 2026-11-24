import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import { enterUp } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { ChatClip, Camera, CameraKey } from '../footage/ChatClip';
import { COLORS, CONTENT, FONTS, TYPE } from '../tokens';

const CALLOUT_H = 72;
const CLIP_TOP = CALLOUT_H;
const CLIP_H = CONTENT.height - CLIP_TOP;
const DISSOLVE = 10;

/**
 * Tomada T2 em 1×, em três trechos:
 *  - ferramentas e widget (0–192): a timeline termina e o widget entra (~f96);
 *  - texto (182–360): mesma tomada, enquadrada acima do widget. Quando o texto
 *    começa (~f190), cada linha nova empurra o widget para baixo; esse ajuste do
 *    layout fica fora do quadro e só aparece o texto rolando;
 *  - chip (360–570): clique no filtro sugerido e o painel reagindo.
 */
const TOOLS = { from: 0, duration: 192, offsetFromWidget: -110 / 60 };
const TEXT = { from: 182, duration: 178, offsetFromWidget: (182 - 110) / 60 };
const CHIP = { from: 360, duration: 210 };

const CALLOUTS = [
  { from: 0, duration: 92, text: 'ferramentas e tempos reais' },
  { from: 92, duration: 94, text: 'gráfico na resposta · 5 tipos de widget' },
  { from: 186, duration: 174, text: 'resposta em streaming' },
  { from: 360, duration: 210, text: '1 clique no painel, com desfazer' },
];

/** Enquadramentos medidos na tomada (px CSS do viewport 1920 × 1080). */
const CAM_TOOLS: CameraKey[] = [
  { frame: 0, x: 1500, y: 395, w: 420 },
  { frame: 192, x: 1508, y: 400, w: 404 },
];
const CAM_TEXT: CameraKey[] = [
  { frame: 0, x: 1500, y: 205, w: 420 },
  { frame: 178, x: 1500, y: 195, w: 420 },
];
const CAM_CHIP: Camera = { x: 1500, y: 880, w: 420 };
const CAM_KPI: Camera = { x: 300, y: 210, w: 597 };

const Dissolve: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, DISSOLVE], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return <div style={{ position: 'absolute', inset: 0, opacity }}>{children}</div>;
};

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

/** Chip do chat em cima e KPIs do painel embaixo, no mesmo instante da tomada. */
const ChipAndKpi: React.FC = () => {
  const chipH = 220;
  const labelTop = chipH + 22;
  const kpiTop = labelTop + 46;
  const kpiH = 300;
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <ChatClip take="compare" at="chip" offset={-1.2} camera={CAM_CHIP} width={CONTENT.width} height={chipH} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: labelTop,
          fontFamily: FONTS.mono,
          fontSize: TYPE.small,
          color: COLORS.textMuted,
        }}
      >
        o painel na mesma tomada
      </div>
      <div style={{ position: 'absolute', left: 0, top: kpiTop }}>
        <ChatClip
          take="compare"
          source="kpi"
          at="chip"
          offset={-1.2}
          camera={CAM_KPI}
          showCursor={false}
          width={CONTENT.width}
          height={kpiH}
        />
      </div>
    </div>
  );
};

/**
 * Cena 5 · O agente trabalhando (570 frames). A tomada real T2 tocando em 1×
 * num trecho contínuo (timeline, widget, texto) e depois o clique no chip com
 * o painel reagindo. Um callout por momento.
 */
export const Scene5_Live: React.FC = () => (
  <SceneShell
    kicker="AG-UI 1.0 · streaming"
    headline="Você vê o agente trabalhar."
    why="Sai o loading simulado. Entra o que de fato está acontecendo."
    whyFrom={24}
  >
    {CALLOUTS.map((c) => (
      <Sequence key={c.text} from={c.from} durationInFrames={c.duration} layout="none">
        <Callout text={c.text} />
      </Sequence>
    ))}

    <div style={{ position: 'absolute', left: 0, top: CLIP_TOP, width: CONTENT.width, height: CLIP_H }}>
      <Sequence from={TOOLS.from} durationInFrames={TOOLS.duration} layout="none">
        <ChatClip
          take="compare"
          at="widget"
          offset={TOOLS.offsetFromWidget}
          showCursor={false}
          camera={CAM_TOOLS}
          width={CONTENT.width}
          height={CLIP_H}
        />
      </Sequence>
      <Sequence from={TEXT.from} durationInFrames={TEXT.duration + DISSOLVE} layout="none">
        <Dissolve>
          <ChatClip
            take="compare"
            at="widget"
            offset={TEXT.offsetFromWidget}
            showCursor={false}
            camera={CAM_TEXT}
            width={CONTENT.width}
            height={CLIP_H}
          />
        </Dissolve>
      </Sequence>
      <Sequence from={CHIP.from} durationInFrames={CHIP.duration} layout="none">
        <Dissolve>
          <ChipAndKpi />
        </Dissolve>
      </Sequence>
    </div>
  </SceneShell>
);
