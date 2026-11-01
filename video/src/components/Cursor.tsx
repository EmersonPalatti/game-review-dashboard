import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { CursorState, TimelineEvent } from '../types';

interface CursorProps {
  cursor?: CursorState;
  events?: TimelineEvent[];
  videoFrame: number;
  containerWidth?: number;
  containerHeight?: number;
}

export const Cursor: React.FC<CursorProps> = ({
  cursor,
  events = [],
  videoFrame,
  containerWidth = 1600,
  containerHeight = 900,
}) => {
  if (!cursor || cursor.hidden) {
    return null;
  }

  // Scale from capture resolution (2560x1440) to container dimensions
  const scaleX = containerWidth / 2560;
  const scaleY = containerHeight / 1440;
  const x = cursor.x * scaleX;
  const y = cursor.y * scaleY;

  // Check recent clicks within 20 frames
  const recentClicks = events.filter(
    (e) => e.type === 'click' && videoFrame >= e.frame && videoFrame <= e.frame + 20
  );

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        pointerEvents: 'none',
        zIndex: 9999,
        transform: cursor.down ? 'scale(0.88)' : 'scale(1)',
      }}
    >
      {/* Ripple ring on click */}
      {recentClicks.map((clickEvent) => {
        const clickAge = videoFrame - clickEvent.frame;
        const ringProgress = interpolate(clickAge, [0, 20], [0, 1], {
          extrapolateRight: 'clamp',
        });
        const ringSize = interpolate(ringProgress, [0, 1], [10, 48]);
        const ringOpacity = interpolate(ringProgress, [0, 0.2, 1], [0.9, 0.8, 0]);

        return (
          <div
            key={clickEvent.frame}
            style={{
              position: 'absolute',
              left: -ringSize / 2,
              top: -ringSize / 2,
              width: ringSize,
              height: ringSize,
              borderRadius: '50%',
              border: '2px solid #8fbfa8',
              backgroundColor: 'rgba(143, 191, 168, 0.2)',
              opacity: ringOpacity,
            }}
          />
        );
      })}

      {/* SVG Mouse Pointer */}
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        style={{
          filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55))',
          transform: 'translate(-2px, -2px)',
        }}
      >
        <path
          d="M3 2 L3 19 L7.5 15 L11.5 22.5 L14 21 L10 13.8 L16.5 13.8 Z"
          fill="#f4f4f2"
          stroke="#161513"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
