import React from 'react';
import { useVideoConfig } from 'remotion';
import { THEME } from './theme';

export const Background: React.FC = () => {
  const { width, height } = useVideoConfig();

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        backgroundColor: THEME.colors.bg,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.022) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.022) 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 80,
          border: '1px solid rgba(242, 240, 235, 0.035)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};
