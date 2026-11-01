import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

interface CalloutProps {
  title: string;
  subtitle?: string;
  startFrame: number;
  durationInFrames: number;
}

export const Callout: React.FC<CalloutProps> = ({
  title,
  subtitle,
  startFrame,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const relFrame = frame - startFrame;
  if (relFrame < 0 || relFrame > durationInFrames) {
    return null;
  }

  // Animate in using spring
  const enterProgress = spring({
    frame: relFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  // Animate out at the end
  const exitDuration = 15;
  const exitStart = durationInFrames - exitDuration;
  const exitProgress =
    relFrame > exitStart
      ? interpolate(relFrame - exitStart, [0, exitDuration], [1, 0], {
          extrapolateRight: 'clamp',
        })
      : 1;

  const opacity = interpolate(enterProgress, [0, 1], [0, 1]) * exitProgress;
  const translateY = interpolate(enterProgress, [0, 1], [24, 0]) + (1 - exitProgress) * 12;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 48,
        left: 56,
        zIndex: 9000,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
        borderRadius: '12px',
        backgroundColor: 'rgba(24, 22, 20, 0.88)',
        backdropFilter: 'blur(16px)',
        border: '1px solid #34302b',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#8fbfa8',
          boxShadow: '0 0 10px #8fbfa8',
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span
          style={{
            fontSize: '15px',
            fontWeight: 600,
            color: '#efe9de',
            letterSpacing: '0.01em',
          }}
        >
          {title}
        </span>
        {subtitle && (
          <span
            style={{
              fontSize: '12px',
              color: '#aaa398',
              fontWeight: 400,
              marginTop: '2px',
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
};

