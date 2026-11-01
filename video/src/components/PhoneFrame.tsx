import React from 'react';
import {
  Freeze,
  interpolate,
  OffthreadVideo,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { TimelineData } from '../types';
import mobileTimelineRaw from '../../public/mobile.timeline.json';

const mobileTimeline = mobileTimelineRaw as unknown as TimelineData;

interface PhoneFrameProps {
  durationInFrames: number;
}

export const PhoneFrame: React.FC<PhoneFrameProps> = ({ durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring from the right (relativo ao início da Sequence)
  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 80 },
  });

  // Exit transition to the right (smooth Hermite curve nos últimos 35 frames)
  const exitDuration = 35;
  const exitStart = durationInFrames - exitDuration;
  const rawExit =
    frame >= exitStart
      ? interpolate(frame - exitStart, [0, exitDuration], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 0;
  // Hermite smoothstep S-curve
  const exitEase = rawExit * rawExit * (3 - 2 * rawExit);

  const translateX = interpolate(entrance, [0, 1], [600, 0]) + exitEase * 180;
  const opacity = interpolate(entrance, [0, 1], [0, 1]) * (1 - exitEase);
  const scale = interpolate(entrance, [0, 1], [0.92, 1]) - exitEase * 0.06;

  // Phone dimensions
  const phoneWidth = 380;
  const phoneHeight = 824;

  // Cursor touch tracking
  const videoFrame = Math.min(frame, (mobileTimeline.totalFrames || 420) - 1);
  const currentCursor = mobileTimeline.frames?.[videoFrame]?.cursor;
  const cursorScaleX = phoneWidth / 1170;
  const cursorScaleY = phoneHeight / 2532;

  // Recent taps within 20 frames
  const recentTaps = (mobileTimeline.events || []).filter(
    (e) => (e.type === 'tap' || e.type === 'click') && videoFrame >= e.frame && videoFrame <= e.frame + 20
  );

  return (
    <div
      style={{
        position: 'absolute',
        right: 110,
        top: 128,
        width: phoneWidth,
        height: phoneHeight,
        zIndex: 8000,
        opacity,
        transform: `translateX(${translateX}px) scale(${scale})`,
        borderRadius: '46px',
        boxShadow: '0 28px 70px rgba(0, 0, 0, 0.65), 0 0 0 10px #1f1d1b, 0 0 0 12px #34302b',
        backgroundColor: '#12110f',
        overflow: 'hidden',
      }}
    >
      {/* Video Content */}
      <div
        style={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          borderRadius: '38px',
          position: 'relative',
        }}
      >
        <Freeze frame={415} active={videoFrame >= 415}>
          <OffthreadVideo
            src={staticFile('mobile.mp4')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </Freeze>

        {/* Touch Cursor & Tap Ripple Overlay */}
        {currentCursor && !currentCursor.hidden && (
          <div
            style={{
              position: 'absolute',
              left: currentCursor.x * cursorScaleX,
              top: currentCursor.y * cursorScaleY,
              pointerEvents: 'none',
              zIndex: 9999,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Tap Ripple Ring (from recentTaps) */}
            {recentTaps.map((tapEvent) => {
              const tapAge = videoFrame - tapEvent.frame;
              const ringProgress = interpolate(tapAge, [0, 20], [0, 1], {
                extrapolateRight: 'clamp',
              });
              const ringSize = interpolate(ringProgress, [0, 1], [16, 64]);
              const ringOpacity = interpolate(ringProgress, [0, 0.2, 1], [0.8, 0.6, 0]);

              return (
                <div
                  key={tapEvent.frame}
                  style={{
                    position: 'absolute',
                    left: 16 - ringSize / 2,
                    top: 16 - ringSize / 2,
                    width: ringSize,
                    height: ringSize,
                    borderRadius: '50%',
                    border: '2px solid #8fbfa8',
                    backgroundColor: 'rgba(143, 191, 168, 0.25)',
                    opacity: ringOpacity,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}

            {/* Visual Touch Circle (100% deterministic, no CSS transition) */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: currentCursor.down
                  ? 'rgba(143, 191, 168, 0.45)'
                  : 'rgba(255, 255, 255, 0.25)',
                border: '2px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
                transform: currentCursor.down ? 'scale(0.85)' : 'scale(1)',
              }}
            />
          </div>
        )}

        {/* Dynamic Island / Notch */}
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '105px',
            height: '26px',
            backgroundColor: '#0a0a09',
            borderRadius: '16px',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '10px',
          }}
        >
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: '#161a22',
            }}
          />
        </div>
      </div>
    </div>
  );
};

