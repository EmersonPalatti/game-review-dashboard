import React from 'react';
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const CROSSFADE_FRAMES = 18;
export const OVERLAP_FRAMES = 6;

export const SceneTransition: React.FC<{
  durationInFrames: number;
  isFirst?: boolean;
  isLast?: boolean;
  children: React.ReactNode;
}> = ({ durationInFrames, isFirst = false, isLast = false, children }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
  const easeIn = Easing.bezier(0.7, 0, 0.84, 0);

  const fadeIn = isFirst
    ? interpolate(frame, [0, 18], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: easeOut,
      })
    : interpolate(frame, [0, CROSSFADE_FRAMES], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: easeOut,
      });

  const fadeOut = isLast
    ? 1
    : interpolate(
        frame,
        [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
        [1, 0],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: easeIn,
        }
      );

  const yIn = interpolate(frame, [0, CROSSFADE_FRAMES], [12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });

  const yOut = isLast
    ? 0
    : interpolate(
        frame,
        [durationInFrames - CROSSFADE_FRAMES, durationInFrames],
        [0, -12],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: easeIn,
        }
      );

  return (
    <div
      style={{
        position: 'absolute',
        width,
        height,
        opacity: fadeIn * fadeOut,
        transform: `translateY(${yIn + yOut}px)`,
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
};
