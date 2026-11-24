import React from 'react';
import { interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS, EASE_IN_OUT, FONTS, withAlpha } from '../tokens';
import { ArrowCursor } from '../mock/ChatMock';
import { ClipSource, TAKES, TakeId, fastSegments, markFrame, proxyFor } from './takes';

export type { ClipSource, TakeId } from './takes';

/**
 * Enquadramento da tomada em px CSS do viewport de captura (1920 × 1080):
 * canto superior esquerdo e largura. A altura sai da proporção do quadro.
 */
export interface Camera {
  x: number;
  y: number;
  w: number;
}

/** Ponto de câmera no tempo do clipe (frames locais do clipe). */
export interface CameraKey extends Camera {
  frame: number;
}

/** Painel do chat acoplado (≥ 1440 px de viewport: 420 px à direita). */
export const CHAT_PANEL: Camera = { x: 1500, y: 0, w: 420 };

export interface ChatClipProps {
  take: TakeId;
  /** Recorte da tomada: painel do chat (padrão), KPIs do painel ou o app inteiro. */
  source?: ClipSource;
  /** Mark do timeline.json que coincide com o frame 0 do clipe (ex.: 'widget'). */
  at: string;
  /** Segundos somados ao mark (pode ser negativo). */
  offset?: number;
  /** Enquadramento fixo ou animado. Padrão: painel do chat inteiro na largura. */
  camera?: Camera | CameraKey[];
  /** Frame da cena em que o clipe começa a tocar. */
  startAtFrame?: number;
  /** Duração do clipe em frames da cena. */
  durationInFrames?: number;
  playbackRate?: number;
  /** Tamanho do quadro na composição, em px. */
  width: number;
  height: number;
  /** Desenha o cursor gravado na tomada. */
  showCursor?: boolean;
  /** Selo "⏩ N×" nos trechos acelerados. Desligue só se o clipe não cobrir nenhum. */
  showFastBadge?: boolean;
  radius?: number;
  style?: React.CSSProperties;
}

export function cameraAt(camera: Camera | CameraKey[], frame: number): Camera {
  if (!Array.isArray(camera)) return camera;
  if (camera.length === 1) return camera[0];
  const frames = camera.map((k) => k.frame);
  const opts = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE_IN_OUT } as const;
  return {
    x: interpolate(frame, frames, camera.map((k) => k.x), opts),
    y: interpolate(frame, frames, camera.map((k) => k.y), opts),
    w: interpolate(frame, frames, camera.map((k) => k.w), opts),
  };
}

const ClipBody: React.FC<Required<Pick<ChatClipProps, 'take' | 'source' | 'width' | 'height' | 'playbackRate'>> & {
  startVideoFrame: number;
  camera: Camera | CameraKey[];
  showCursor: boolean;
  showFastBadge: boolean;
  radius: number;
  style?: React.CSSProperties;
}> = ({ take, source, width, height, playbackRate, startVideoFrame, camera, showCursor, showFastBadge, radius, style }) => {
  const frame = useCurrentFrame();
  const info = TAKES[take];
  const videoFrame = Math.min(
    info.timeline.totalFrames - 1,
    Math.max(0, Math.round(startVideoFrame + frame * playbackRate)),
  );

  const cam = cameraAt(camera, frame);
  // px da composição por px CSS da página
  const k = width / cam.w;
  const { src, region } = proxyFor(take, source);

  const cursorState = info.timeline.frames[videoFrame]?.cursor;
  const cursorVisible = showCursor && cursorState && !cursorState.hidden;
  // O timeline guarda o cursor em px do vídeo original (2 px por px CSS).
  const cursorX = cursorState ? (cursorState.x / 2 - cam.x) * k : 0;
  const cursorY = cursorState ? (cursorState.y / 2 - cam.y) * k : 0;
  const clickEvent = info.timeline.events.find(
    (e) => e.type === 'click' && videoFrame >= e.frame && videoFrame < e.frame + 24,
  );
  const ripple = clickEvent ? (videoFrame - clickEvent.frame) / 24 : null;

  const fastSegment = fastSegments(take).find((s) => videoFrame >= s.from && videoFrame < s.to);
  // Velocidade real na tela: trecho acelerado na captura × playbackRate do clipe.
  const speed = Math.round((fastSegment?.speed ?? 1) * playbackRate * 10) / 10;
  const showSpeed = showFastBadge && speed > 1.01;

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        overflow: 'hidden',
        borderRadius: radius,
        border: `1px solid ${COLORS.borderLight}`,
        backgroundColor: COLORS.surface,
        ...style,
      }}
    >
      {/*
        Caixa fixa em px CSS da página e câmera só no transform. Com left/top/width
        fracionários o Chrome arredonda a caixa do vídeo para o pixel inteiro a cada
        quadro, e num zoom lento a imagem vai e volta ~0,5 px por quadro (tremor).
        O transform é pintado com precisão de subpixel.
      */}
      <OffthreadVideo
        src={staticFile(src)}
        trimBefore={startVideoFrame}
        playbackRate={playbackRate}
        muted
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: region.w,
          height: region.h,
          maxWidth: 'none',
          transformOrigin: '0 0',
          transform: `translate(${(region.x - cam.x) * k}px, ${(region.y - cam.y) * k}px) scale(${k})`,
        }}
      />

      {cursorVisible ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${cursorX}px, ${cursorY}px)`,
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
          <ArrowCursor pressed={Boolean(cursorState?.down)} size={34} />
        </div>
      ) : null}

      {showSpeed ? (
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
            fontSize: 24,
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg width={22} height={14} viewBox="0 0 22 14" aria-hidden>
            <path d="M1 1 L10 7 L1 13 Z M11 1 L20 7 L11 13 Z" fill={COLORS.amber} />
          </svg>
          {speed.toLocaleString("pt-BR")}× acelerado
        </div>
      ) : null}
    </div>
  );
};

/** Tomada real do chat enquadrada num quadro da composição. */
export const ChatClip: React.FC<ChatClipProps> = ({
  take,
  source = 'chat',
  at,
  offset = 0,
  camera = CHAT_PANEL,
  startAtFrame = 0,
  durationInFrames,
  playbackRate = 1,
  width,
  height,
  showCursor = true,
  showFastBadge = true,
  radius = 20,
  style,
}) => {
  const { fps } = useVideoConfig();
  const startVideoFrame = Math.max(0, Math.round(markFrame(take, at) + offset * fps));
  return (
    <Sequence from={startAtFrame} durationInFrames={durationInFrames} layout="none" name={`tomada ${take} · ${at}`}>
      <ClipBody
        take={take}
        source={source}
        width={width}
        height={height}
        playbackRate={playbackRate}
        startVideoFrame={startVideoFrame}
        camera={camera}
        showCursor={showCursor}
        showFastBadge={showFastBadge}
        radius={radius}
        style={style}
      />
    </Sequence>
  );
};
