import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import { enterUp, progress } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import type { SfxEvent } from '../ChatUpgradeAudio';
import { CameraKey, ChatClip, cameraAt } from '../footage/ChatClip';
import { COLORS, CONTENT, EASE_IN_OUT, FONTS, withAlpha } from '../tokens';

/**
 * Cena "real" (540 frames): o único trecho com tomada real na versão 100% motion.
 *  - Close (0–220): o painel do chat da tomada T2 com as ferramentas fechando e o
 *    widget entrando, em 1×.
 *  - Plano aberto (210–540): o app inteiro. O cursor clica no chip sugerido e o
 *    painel todo filtra para o NieR; depois aparece o Desfazer. Também em 1×.
 */

const CALLOUT_H = 76;
const CLOSE = { from: 0, duration: 220, offsetFromWidget: -110 / 60 };
const DISSOLVE = 16;
const WIDE_FROM = 210;
/** Frame da cena em que o clique da tomada acontece. */
const CLICK = 338;

const WIDE_W = 1000;
const WIDE_H = 562;
const WIDE_LEFT = -32; // sangra até a moldura de 40 px do fundo
/** O plano aberto começa no clique menos este tanto de frames da tomada. */
const WIDE_LEAD = CLICK - WIDE_FROM;

const CAM_CLOSE = { x: 1500, y: 395, w: 420 };
/** App inteiro; depois do clique, aproxima devagar dos KPIs e do chat. */
const CAM_WIDE: CameraKey[] = [
  { frame: 0, x: 0, y: 0, w: 1920 },
  { frame: CLICK - WIDE_FROM + 14, x: 0, y: 0, w: 1920 },
  { frame: CLICK - WIDE_FROM + 104, x: 280, y: 0, w: 1640 },
];

/** Retângulos em px CSS da página (1920 × 1080), medidos na tomada. */
const RECTS = {
  chip: { x: 1586, y: 626, w: 186, h: 38 },
  undo: { x: 1766, y: 626, w: 88, h: 38 },
  kpis: { x: 306, y: 250, w: 1176, h: 148 },
  filter: { x: 306, y: 24, w: 172, h: 40 },
};

const STEPS = [
  { from: WIDE_FROM + 20, to: CLICK + 10, text: '1 · clique no filtro sugerido', rings: ['chip'] as const },
  { from: CLICK + 10, to: CLICK + 110, text: '2 · o painel inteiro filtra para o NieR', rings: ['kpis', 'filter'] as const },
  { from: CLICK + 110, to: 540, text: '3 · Desfazer volta ao filtro anterior', rings: ['undo'] as const },
];

export const M7_SFX: SfxEvent[] = [{ name: 'chip na tomada real', frame: CLICK, src: 'audio/click.wav', volume: 0.3 }];

const Callout: React.FC<{ text: string; tone?: 'emerald' | 'neutral' }> = ({ text, tone = 'emerald' }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, ...enterUp(frame, 0, 16, 10) }}>
      <Tag tone={tone} shape="pill">
        {text}
      </Tag>
    </div>
  );
};

/** Anel esmeralda sobre um retângulo da página, seguindo a câmera do plano aberto. */
const Ring: React.FC<{ rect: { x: number; y: number; w: number; h: number }; localFrame: number; t: number }> = ({
  rect,
  localFrame,
  t,
}) => {
  if (t <= 0) return null;
  const cam = cameraAt(CAM_WIDE, localFrame);
  const k = WIDE_W / cam.w;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: rect.w * k,
        height: rect.h * k,
        transform: `translate(${(rect.x - cam.x) * k}px, ${(rect.y - cam.y) * k}px)`,
        borderRadius: 8,
        border: `3px solid ${COLORS.emerald}`,
        boxShadow: `0 0 0 6px ${withAlpha(COLORS.emerald, 0.18)}, 0 0 28px ${withAlpha(COLORS.emerald, 0.45)}`,
        opacity: t,
        pointerEvents: 'none',
      }}
    />
  );
};

export const M7_Real: React.FC = () => {
  const frame = useCurrentFrame();
  const closeIn = enterUp(frame, 0, 22, 18);
  const wideIn = progress(frame, WIDE_FROM, DISSOLVE);
  const wideLocal = frame - WIDE_FROM;
  // Frame da tomada no início do plano aberto: o clique cai em CLICK.
  const wideOffset = -WIDE_LEAD / 60;

  return (
    <SceneShell
      kicker="Tomada real · SteamBot-9000 v2"
      headline="No app, de verdade."
      why="A mesma conversa, gravada no dashboard em funcionamento."
      whyFrom={60}
    >
      <Sequence from={0} durationInFrames={WIDE_FROM + 10} layout="none">
        <Callout text="mesma pergunta · tomada real em 1×" tone="neutral" />
      </Sequence>
      {STEPS.map((s) => (
        <Sequence key={s.text} from={s.from} durationInFrames={s.to - s.from} layout="none">
          <Callout text={s.text} />
        </Sequence>
      ))}

      {/* Close no chat */}
      {wideIn < 1 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: CALLOUT_H,
            ...closeIn,
            opacity: closeIn.opacity * (1 - wideIn),
          }}
        >
          <ChatClip
            take="compare"
            at="widget"
            offset={CLOSE.offsetFromWidget}
            durationInFrames={WIDE_FROM + DISSOLVE}
            showCursor={false}
            camera={CAM_CLOSE}
            width={CONTENT.width}
            height={CONTENT.height - CALLOUT_H}
          />
        </div>
      ) : null}

      {/* Plano aberto: o app inteiro reagindo ao clique */}
      <Sequence from={WIDE_FROM} layout="none">
        <div
          style={{
            position: 'absolute',
            left: WIDE_LEFT,
            top: CALLOUT_H,
            width: WIDE_W,
            height: WIDE_H,
            opacity: wideIn,
          }}
        >
          <ChatClip
            take="compare"
            source="full"
            at="chip"
            offset={wideOffset}
            camera={CAM_WIDE}
            width={WIDE_W}
            height={WIDE_H}
            radius={14}
          />
          {STEPS.flatMap((s) =>
            s.rings.map((r) => {
              const t = interpolate(frame, [s.from, s.from + 12, s.to - 10, s.to], [0, 1, 1, 0], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
                easing: EASE_IN_OUT,
              });
              return <Ring key={`${s.text}-${r}`} rect={RECTS[r]} localFrame={wideLocal} t={t} />;
            }),
          )}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: CALLOUT_H + WIDE_H + 18,
            fontFamily: FONTS.mono,
            fontSize: 24,
            color: COLORS.textMuted,
            opacity: wideIn,
          }}
        >
          app inteiro · cursor e cliques da gravação
        </div>
      </Sequence>
    </SceneShell>
  );
};
