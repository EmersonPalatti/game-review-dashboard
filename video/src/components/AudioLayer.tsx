import React from 'react';
import { Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';

interface AudioLayerProps {
  totalFrames: number;
}

export const AudioLayer: React.FC<AudioLayerProps> = ({ totalFrames }) => {
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

  // Sound Effect Triggers (frame numbers aligned with new timeline)
  const soundEvents = [
    // Theme toggle light
    { frame: 240, src: 'audio/click.wav', volume: 0.65 },
    { frame: 244, src: 'audio/whoosh.wav', volume: 0.35 },
    // Combo select
    { frame: 557, src: 'audio/click.wav', volume: 0.6 },
    // Crossfilter
    { frame: 909, src: 'audio/click.wav', volume: 0.65 },
    { frame: 915, src: 'audio/tap.wav', volume: 0.4 },
    // Preset
    { frame: 1261, src: 'audio/click.wav', volume: 0.6 },
    // Table sort & expand
    { frame: 1553, src: 'audio/click.wav', volume: 0.6 },
    { frame: 1725, src: 'audio/click.wav', volume: 0.6 },
    // Clear filters & Theme toggle dark
    { frame: 2005, src: 'audio/click.wav', volume: 0.6 },
    { frame: 2165, src: 'audio/click.wav', volume: 0.65 },
    { frame: 2168, src: 'audio/whoosh.wav', volume: 0.35 },
    // Mobile entry & interactions
    { frame: 2210, src: 'audio/whoosh.wav', volume: 0.4 },
    { frame: 2270, src: 'audio/tap.wav', volume: 0.55 },
    { frame: 2334, src: 'audio/click.wav', volume: 0.55 },
    { frame: 2374, src: 'audio/tap.wav', volume: 0.55 },
    { frame: 2540, src: 'audio/whoosh.wav', volume: 0.35 },
  ];

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
