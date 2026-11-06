import React from 'react';
import { Freeze, OffthreadVideo, staticFile } from 'remotion';
import { Cursor } from './Cursor';
import { CursorState, TimelineEvent } from '../types';

interface BrowserFrameProps {
  cursor?: CursorState;
  events?: TimelineEvent[];
  videoFrame: number;
  freezeAt: number;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({
  cursor,
  events,
  videoFrame,
  freezeAt,
}) => {
  // Browser window dimensions
  const browserWidth = 1600;
  const browserHeight = 938;
  const chromeHeight = 38;
  const contentHeight = browserHeight - chromeHeight; // 900px (16:9)

  return (
    <div
      style={{
        width: browserWidth,
        height: browserHeight,
        borderRadius: '16px',
        backgroundColor: '#161513',
        border: '1px solid #34302b',
        boxShadow:
          '0 32px 80px rgba(0, 0, 0, 0.75), 0 0 0 1px rgba(255, 255, 255, 0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Browser Chrome Header */}
      <div
        style={{
          height: chromeHeight,
          backgroundColor: '#1c1a18',
          borderBottom: '1px solid #2e2b26',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          gap: '14px',
          userSelect: 'none',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Traffic Light Window Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ff5f56',
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#ffbd2e',
            }}
          />
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#27c93f',
            }}
          />
        </div>

        {/* Address / URL Bar */}
        <div
          style={{
            flex: 1,
            maxWidth: '480px',
            margin: '0 auto',
            height: '24px',
            borderRadius: '6px',
            backgroundColor: '#12110f',
            border: '1px solid #2e2b26',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '0 12px',
          }}
        >
          {/* Lock SVG Icon */}
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#8fbfa8"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span
            style={{
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: '11px',
              color: '#8a847a',
              letterSpacing: '0.01em',
            }}
          >
            localhost:4321 · Reviews da Steam (1.000.000 avaliações)
          </span>
        </div>

        {/* Right spacing balance */}
        <div style={{ width: '46px' }} />
      </div>

      {/* Browser Viewport Content (Dashboard Video) */}
      <div
        style={{
          width: browserWidth,
          height: contentHeight,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#161513',
        }}
      >
        <Freeze frame={freezeAt} active={videoFrame >= freezeAt}>
          <OffthreadVideo
            src={staticFile('desktop.mp4')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
            }}
          />
        </Freeze>

        {/* Cursor tracking in Browser Viewport coordinates */}
        {cursor && (
          <Cursor
            cursor={cursor}
            events={events}
            videoFrame={videoFrame}
            containerWidth={browserWidth}
            containerHeight={contentHeight}
          />
        )}
      </div>
    </div>
  );
};

