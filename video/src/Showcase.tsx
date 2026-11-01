import React from 'react';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

import { TimelineData } from './types';
import { BrowserFrame } from './components/BrowserFrame';
import { Callout } from './components/Callout';
import { TitleOverlay } from './components/TitleOverlay';
import { PhoneFrame } from './components/PhoneFrame';
import { EndCard } from './components/EndCard';
import { AudioLayer } from './components/AudioLayer';

import desktopTimelineRaw from '../public/desktop.timeline.json';

const desktopTimeline = desktopTimelineRaw as unknown as TimelineData;

export const Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Desktop video frame index clamped to duration of recording (2349 frames)
  const desktopVideoFrame = Math.min(frame, desktopTimeline.totalFrames - 1);
  const currentCursor = desktopTimeline.frames[desktopVideoFrame]?.cursor;

  // Browser dimensions
  const browserW = 1600;
  const browserH = 938;
  const initialLeft = (width - browserW) / 2; // 160
  const initialTop = (height - browserH) / 2; // 71

  // -------------------------------------------------------------
  // Camera Keyframe Targets
  // (cx in 0..1600 content coords, cy in 0..900 content coords)
  // -------------------------------------------------------------
  const cameraKeyframes = [
    // 1. Initial overview (cards rise in dark theme)
    { frame: 0, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
    { frame: 130, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },

    // 2. Zoom in deep to #theme-toggle (1.62x)
    { frame: 185, zoom: 1.62, cx: 160, cy: 150, sx: 700, sy: 460 },
    { frame: 275, zoom: 1.62, cx: 160, cy: 150, sx: 700, sy: 460 },

    // 3. Zoom into Combobox search (1.65x)
    { frame: 350, zoom: 1.65, cx: 180, cy: 260, sx: 720, sy: 440 },
    { frame: 640, zoom: 1.65, cx: 180, cy: 260, sx: 720, sy: 440 },

    // 4. Pan to Playtime Chart & KPIs for cross-filtering (1.50x)
    { frame: 720, zoom: 1.50, cx: 620, cy: 560, sx: 900, sy: 520 },
    { frame: 1140, zoom: 1.50, cx: 620, cy: 560, sx: 900, sy: 520 },

    // 5. Pan to Presets bar (1.58x)
    { frame: 1200, zoom: 1.58, cx: 580, cy: 130, sx: 880, sy: 480 },
    { frame: 1350, zoom: 1.58, cx: 580, cy: 130, sx: 880, sy: 480 },

    // 6. Scroll down to Reviews Table (1.12x - Full Browser Window, Header, Active Filters, and Sort/Expand)
    { frame: 1450, zoom: 1.12, cx: 800, cy: 280, sx: 960, sy: 470 },
    { frame: 1810, zoom: 1.12, cx: 800, cy: 280, sx: 960, sy: 470 },

    // 7. Scroll up and ease back to unzoomed overview (1.0x)
    { frame: 1910, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
    { frame: 2200, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
  ];

  // Helper to interpolate smoothly between camera keyframes
  const getCameraState = (curFrame: number) => {
    if (curFrame <= cameraKeyframes[0].frame) {
      return cameraKeyframes[0];
    }
    const last = cameraKeyframes[cameraKeyframes.length - 1];
    if (curFrame >= last.frame) {
      return last;
    }
    for (let i = 0; i < cameraKeyframes.length - 1; i++) {
      const k1 = cameraKeyframes[i];
      const k2 = cameraKeyframes[i + 1];
      if (curFrame >= k1.frame && curFrame <= k2.frame) {
        const rawT = (curFrame - k1.frame) / (k2.frame - k1.frame);
        // Smooth Hermite / S-curve easing
        const t = rawT * rawT * (3 - 2 * rawT);
        return {
          zoom: k1.zoom + (k2.zoom - k1.zoom) * t,
          cx: k1.cx + (k2.cx - k1.cx) * t,
          cy: k1.cy + (k2.cy - k1.cy) * t,
          sx: k1.sx + (k2.sx - k1.sx) * t,
          sy: k1.sy + (k2.sy - k1.sy) * t,
        };
      }
    }
    return last;
  };

  const { zoom, cx, cy, sx, sy } = getCameraState(frame);

  // Position of target in 1920x1080 canvas coordinates
  const targetCanvasX = initialLeft + cx;
  const targetCanvasY = initialTop + 38 + cy;

  // Zoom transform (transformOrigin: 0 0)
  const cameraTx = sx - targetCanvasX * zoom;
  const cameraTy = sy - targetCanvasY * zoom;

  // -------------------------------------------------------------
  // Mobile Split Screen Transition (Frame 2200 to 2600)
  // -------------------------------------------------------------
  const isSplitPhase = frame >= 2200;
  const splitEntrance = spring({
    frame: Math.max(0, frame - 2200),
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  const splitAmount = isSplitPhase
    ? interpolate(splitEntrance, [0, 1], [0, 1])
    : 0;

  // Desktop container transform during normal vs split mode
  const finalScale = interpolate(splitAmount, [0, 1], [zoom, 0.62]);
  const finalTx = interpolate(splitAmount, [0, 1], [cameraTx, -230]);
  const finalTy = interpolate(splitAmount, [0, 1], [cameraTy, (height - browserH * 0.62) / 2]);

  // Overall Desktop Opacity (fades out as EndCard arrives at frame 2565)
  const desktopOpacity =
    frame >= 2555
      ? interpolate(frame, [2555, 2590], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#100f0e',
        overflow: 'hidden',
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
      {/* Subtle Ambient Radial Glow */}
      <div
        style={{
          position: 'absolute',
          width: '900px',
          height: '900px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(143, 191, 168, 0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Audio Engine (Music + SFX) */}
      <AudioLayer totalFrames={2700} />

      {/* Camera / Desktop Browser Container */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          opacity: desktopOpacity,
          transformOrigin: '0 0',
          transform: `translate(${finalTx}px, ${finalTy}px) scale(${finalScale})`,
          transition: 'none',
        }}
      >
        <div style={{ position: 'relative', left: initialLeft, top: initialTop }}>
          <BrowserFrame
            cursor={currentCursor}
            events={desktopTimeline.events}
            videoFrame={desktopVideoFrame}
          />
        </div>
      </div>

      {/* Opening Title Overlay (Top-center clean banner, doesn't obstruct UI) */}
      <TitleOverlay durationInFrames={140} />

      {/* Feature Callouts */}
      {/* 1. Theme toggle */}
      <Callout
        title="Tema claro e escuro"
        subtitle="Revelação circular com CSS View Transitions"
        startFrame={160}
        durationInFrames={160}
      />

      {/* 2. Combobox Search */}
      <Callout
        title="Atalho '/' para busca rápida"
        subtitle="Combobox com filtragem instantânea de jogos"
        startFrame={360}
        durationInFrames={260}
      />

      {/* 3. Crossfilter */}
      <Callout
        title="Filtragem cruzada sincronizada"
        subtitle="Hover nos tooltips e atualização reativa de KPIs"
        startFrame={680}
        durationInFrames={440}
      />

      {/* 4. Analytical Presets */}
      <Callout
        title="Recortes guiados do estudo"
        subtitle="Acesso a hipóteses empíricas em um clique"
        startFrame={1170}
        durationInFrames={180}
      />

      {/* 5. Reviews Table */}
      <Callout
        title="Ordenação e inspeção de avaliações"
        subtitle="Detalhamento e expansão de texto completo"
        startFrame={1400}
        durationInFrames={380}
      />

      {/* 6. Clear filters & Dark return */}
      <Callout
        title="Limpeza de filtros & Volta ao escuro"
        subtitle="Retorno ao estado global auditado"
        startFrame={1880}
        durationInFrames={280}
      />

      {/* 7. Mobile Responsive Experience */}
      <Callout
        title="Experiência mobile fluida"
        subtitle="Gaveta de filtros adaptável e interface responsiva"
        startFrame={2210}
        durationInFrames={355}
      />

      {/* Mobile Smartphone Mockup on Split Screen */}
      <Sequence from={2200} durationInFrames={400} layout="none">
        <PhoneFrame durationInFrames={400} />
      </Sequence>

      {/* End Card (Portfolio & Author Info) */}
      <EndCard startFrame={2565} />
    </AbsoluteFill>
  );
};
