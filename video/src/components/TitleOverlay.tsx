import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface TitleOverlayProps {
  durationInFrames: number;
}

export const TitleOverlay: React.FC<TitleOverlayProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame > durationInFrames) {
    return null;
  }

  // Smooth entrance
  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 85 },
  });

  // Fade out towards the end
  const fadeOutStart = durationInFrames - 20;
  const opacityOut =
    frame > fadeOutStart
      ? interpolate(frame - fadeOutStart, [0, 20], [1, 0], { extrapolateRight: 'clamp' })
      : 1;

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * opacityOut;
  const translateY = interpolate(entrance, [0, 1], [-20, 0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 20,
        left: '50%',
        zIndex: 9500,
        opacity,
        transform: `translateX(-50%) translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 24px',
        borderRadius: '999px',
        backgroundColor: 'rgba(22, 21, 19, 0.92)',
        backdropFilter: 'blur(16px)',
        border: '1px solid #34302b',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.45)',
        fontFamily: '"IBM Plex Sans", sans-serif',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: '#8fbfa8',
          boxShadow: '0 0 10px #8fbfa8',
        }}
      />
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: '#efe9de',
          letterSpacing: '-0.01em',
        }}
      >
        Reviews da Steam
      </span>
      <span style={{ color: '#4a453e' }}>·</span>
      <span
        style={{
          fontSize: '13px',
          color: '#aaa398',
          fontWeight: 400,
        }}
      >
        1.000.000 de avaliações · Estudo empírico & filtragem cruzada
      </span>
    </div>
  );
};
