import React from 'react';
import { Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';

export interface SoundEvent {
  frame: number;
  src: string;
  volume: number;
}

interface AudioLayerProps {
  totalFrames: number;
  soundEvents: SoundEvent[];
}

export const AudioLayer: React.FC<AudioLayerProps> = ({ totalFrames, soundEvents }) => {
  const frame = useCurrentFrame();

  // Background Music Volume Envelope
  // 1.5s fade-in (90 frames), steady at 0.28, 3s fade-out at the end (180 frames)
  const fadeIn = interpolate(frame, [0, 90], [0, 0.28], { extrapolateRight: 'clamp' });
  const fadeOutStart = totalFrames - 180;
  const fadeOut =
    frame > fadeOutStart
      ? interpolate(frame - fadeOutStart, [0, 180], [1, 0], { extrapolateRight: 'clamp' })
      : 1;

  const bgVolume = fadeIn * fadeOut;

  return (
    <>
      {/* Background Music */}
      <Audio
        src={staticFile('audio/lofi2_bg.mp3')}
        volume={bgVolume}
        startFrom={0}
      />

      {/* Sound Effects */}
      {soundEvents.map((evt, idx) => {
        if (frame >= evt.frame && frame < evt.frame + 120) {
          return (
            <Audio
              key={`${evt.src}-${evt.frame}-${idx}`}
              src={staticFile(evt.src)}
              volume={evt.volume}
              startFrom={0}
            />
          );
        }
        return null;
      })}
    </>
  );
};
