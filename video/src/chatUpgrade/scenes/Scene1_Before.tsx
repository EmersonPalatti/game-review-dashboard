import React from 'react';
import { interpolate, Sequence, useCurrentFrame } from 'remotion';
import { enterUp } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { Tag } from '../components/Tag';
import { ChatClip, Camera } from '../footage/ChatClip';
import { COLORS, CONTENT, FONTS, TYPE, withAlpha } from '../tokens';

const CLIP_H = 430;
/** Pergunta (y 302–362) e loader (y 375–452) do painel v1. */
const V1_CAMERA: Camera = { x: 1500, y: 270, w: 420 };

/** Cortes da tomada v1 (frames da cena). */
const CUT_A = { from: 0, duration: 156 }; // envio + 2,4 s de loader em 1×
const CUT_B = { from: 156, duration: 120 }; // 22,4 s → 24,4 s, em 1×
const CUT_C_FROM = 276; // a resposta chega inteira
/** Tempo de espera que o corte A→B pula: A termina em 2,4 s e B começa em 22,4 s. */
const SKIPPED_S = 20;

const LIMITS = [
  'Etapas do loading por cronômetro',
  'Enxergava 10 dos 59 jogos',
  'Não buscava no texto das reviews',
  '1 modelo, 900 tokens, sem plano B',
];

const SkipBadge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        padding: '6px 14px',
        borderRadius: 999,
        backgroundColor: withAlpha('#0E0E10', 0.86),
        border: `1px solid ${COLORS.borderLight}`,
        fontFamily: FONTS.mono,
        fontSize: TYPE.small,
        color: COLORS.text,
        ...enterUp(frame, 0, 12, 6),
      }}
    >
      <span style={{ color: COLORS.amber }}>corte</span> · {SKIPPED_S} s depois
    </div>
  );
};

/**
 * Cena 1 · O teto do v1 (390 frames). Tomada real do v1 em três cortes, todos
 * em 1×: o loader logo após o envio, os segundos finais da espera de 24,4 s
 * (o contador do próprio loader mostra o tempo real) e a resposta chegando de
 * uma vez. Abaixo, os quatro limites.
 */
export const Scene1_Before: React.FC = () => {
  const frame = useCurrentFrame();
  const clipIn = enterUp(frame, 0, 22, 20);
  const dim = interpolate(frame, [300, 330], [1, 0.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const stampIn = enterUp(frame, 12, 18, 8);

  return (
    <SceneShell
      kicker="Antes · chat v1"
      headline="O v1 respondia. Mas batia no teto."
      why="O limite estava na arquitetura, não no prompt."
      whyFrom={230}
    >
      <div style={{ position: 'relative', width: CONTENT.width, height: CLIP_H, ...clipIn }}>
        <div style={{ position: 'absolute', inset: 0, opacity: dim }}>
          <ChatClip
            take="v1"
            at="ask"
            offset={-0.2}
            startAtFrame={CUT_A.from}
            durationInFrames={CUT_A.duration}
            camera={V1_CAMERA}
            width={CONTENT.width}
            height={CLIP_H}
          />
          <ChatClip
            take="v1"
            at="skip:18"
            offset={1.2}
            startAtFrame={CUT_B.from}
            durationInFrames={CUT_B.duration}
            camera={V1_CAMERA}
            width={CONTENT.width}
            height={CLIP_H}
          />
          <ChatClip take="v1" at="answer" startAtFrame={CUT_C_FROM} camera={V1_CAMERA} width={CONTENT.width} height={CLIP_H} />
        </div>
        <Sequence from={CUT_B.from} durationInFrames={CUT_B.duration} layout="none">
          <SkipBadge />
        </Sequence>
        <Tag tone="red" solid fontSize={TYPE.small} style={{ position: 'absolute', left: 16, top: 16, ...stampIn }}>
          v1 · tomada real
        </Tag>
      </div>

      <div style={{ position: 'absolute', left: 0, top: CLIP_H + 26, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {LIMITS.map((text, i) => (
          <div key={text} style={{ ...enterUp(frame, 60 + i * 30, 20, 16) }}>
            <Tag tone="red" style={{ color: COLORS.text, borderColor: `${COLORS.red}88` }}>
              <span style={{ color: COLORS.red }}>×</span>
              {text}
            </Tag>
          </div>
        ))}
      </div>
    </SceneShell>
  );
};
