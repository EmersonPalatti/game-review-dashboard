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

import { BrowserFrame } from './components/BrowserFrame';
import { Callout } from './components/Callout';
import { TitleOverlay } from './components/TitleOverlay';
import { PhoneFrame } from './components/PhoneFrame';
import { EndCard } from './components/EndCard';
import { AudioLayer, SoundEvent } from './components/AudioLayer';
import {
  desktopTimeline,
  endCardStart,
  frameOf,
  splitStart,
} from './showcaseTiming';

const span = (from: number, until: number) => Math.max(90, until - from);

export const Showcase: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();

  const desktopVideoFrame = Math.min(frame, desktopTimeline.totalFrames - 1);
  const desktopFrame = desktopTimeline.frames[desktopVideoFrame];
  // Com a página rolada além da viewport, o quadro capturado fica deslocado
  // em relação às coordenadas do mouse. 565px é o ajuste medido nessa tomada.
  const currentCursor =
    desktopFrame?.cursor && desktopFrame.scrollY >= 1700
      ? { ...desktopFrame.cursor, y: desktopFrame.cursor.y - 565 }
      : desktopFrame?.cursor;

  const theme = frameOf('theme');
  const month = frameOf('month');
  const monthClick = frameOf('month-line');
  const dates = frameOf('dates');
  const combo = frameOf('combo');
  const cross = frameOf('crossfilter');
  const preset = frameOf('preset');
  const table = frameOf('table');
  const reset = frameOf('reset');

  const browserW = 1600;
  const browserH = 938;
  const initialLeft = (width - browserW) / 2;
  const initialTop = (height - browserH) / 2;

  const cameraKeyframes = [
    { frame: 0, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
    { frame: 130, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },

    { frame: theme + 53, zoom: 1.62, cx: 160, cy: 150, sx: 700, sy: 460 },
    { frame: theme + 143, zoom: 1.62, cx: 160, cy: 150, sx: 700, sy: 460 },

    { frame: month + 90, zoom: 1.52, cx: 760, cy: 250, sx: 960, sy: 500 },
    { frame: monthClick + 30, zoom: 1.52, cx: 760, cy: 250, sx: 960, sy: 500 },

    { frame: dates + 45, zoom: 1.7, cx: 168, cy: 450, sx: 690, sy: 470 },
    { frame: combo - 20, zoom: 1.7, cx: 168, cy: 420, sx: 690, sy: 470 },

    { frame: combo + 40, zoom: 1.65, cx: 180, cy: 260, sx: 720, sy: 440 },
    { frame: cross - 30, zoom: 1.65, cx: 180, cy: 260, sx: 720, sy: 440 },

    { frame: cross + 50, zoom: 1.5, cx: 620, cy: 560, sx: 900, sy: 520 },
    { frame: preset - 30, zoom: 1.5, cx: 620, cy: 560, sx: 900, sy: 520 },

    { frame: preset + 30, zoom: 1.58, cx: 580, cy: 130, sx: 880, sy: 480 },
    { frame: table - 40, zoom: 1.58, cx: 580, cy: 130, sx: 880, sy: 480 },

    { frame: table + 90, zoom: 1.12, cx: 800, cy: 280, sx: 960, sy: 470 },
    { frame: reset - 40, zoom: 1.12, cx: 800, cy: 280, sx: 960, sy: 470 },

    { frame: reset + 80, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
    { frame: splitStart, zoom: 1.0, cx: 800, cy: 450, sx: 960, sy: 540 },
  ].sort((a, b) => a.frame - b.frame);

  const getCameraState = (curFrame: number) => {
    const first = cameraKeyframes[0];
    if (!first || curFrame <= first.frame) {
      return first;
    }
    const last = cameraKeyframes[cameraKeyframes.length - 1];
    if (!last || curFrame >= last.frame) {
      return last;
    }
    for (let i = 0; i < cameraKeyframes.length - 1; i++) {
      const k1 = cameraKeyframes[i];
      const k2 = cameraKeyframes[i + 1];
      if (!k1 || !k2) continue;
      if (curFrame >= k1.frame && curFrame <= k2.frame) {
        const rawT = (curFrame - k1.frame) / Math.max(1, k2.frame - k1.frame);
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

  const camera = getCameraState(frame);
  const zoom = camera?.zoom ?? 1;
  const cx = camera?.cx ?? 800;
  const cy = camera?.cy ?? 450;
  const sx = camera?.sx ?? 960;
  const sy = camera?.sy ?? 540;

  const targetCanvasX = initialLeft + cx;
  const targetCanvasY = initialTop + 38 + cy;

  const cameraTx = sx - targetCanvasX * zoom;
  const cameraTy = sy - targetCanvasY * zoom;

  const isSplitPhase = frame >= splitStart;
  const splitEntrance = spring({
    frame: Math.max(0, frame - splitStart),
    fps,
    config: { damping: 16, stiffness: 70 },
  });

  const splitAmount = isSplitPhase ? interpolate(splitEntrance, [0, 1], [0, 1]) : 0;

  const finalScale = interpolate(splitAmount, [0, 1], [zoom, 0.62]);
  const finalTx = interpolate(splitAmount, [0, 1], [cameraTx, -230]);
  const finalTy = interpolate(splitAmount, [0, 1], [cameraTy, (height - browserH * 0.62) / 2]);

  const fadeStart = endCardStart - 10;
  const desktopOpacity =
    frame >= fadeStart
      ? interpolate(frame, [fadeStart, fadeStart + 35], [1, 0], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
      : 1;

  const themeLight = frameOf('theme-toggle-light');
  const themeDark = frameOf('theme-toggle-dark');
  const crossClick = frameOf('chart-bar-playtime-2-5h');
  const soundEvents: SoundEvent[] = [
    { frame: themeLight, src: 'audio/click.wav', volume: 0.65 },
    { frame: themeLight + 4, src: 'audio/whoosh.wav', volume: 0.35 },
    { frame: frameOf('zoom-drag'), src: 'audio/tap.wav', volume: 0.35 },
    { frame: monthClick, src: 'audio/click.wav', volume: 0.65 },
    { frame: frameOf('date-preset-2019'), src: 'audio/click.wav', volume: 0.6 },
    { frame: frameOf('date-preset-all'), src: 'audio/click.wav', volume: 0.5 },
    { frame: frameOf('combo-select-darkest-dungeon'), src: 'audio/click.wav', volume: 0.6 },
    { frame: crossClick, src: 'audio/click.wav', volume: 0.65 },
    { frame: crossClick + 6, src: 'audio/tap.wav', volume: 0.4 },
    { frame: frameOf('preset-early'), src: 'audio/click.wav', volume: 0.6 },
    { frame: frameOf('sort-votes-helpful'), src: 'audio/click.wav', volume: 0.6 },
    { frame: frameOf('sort-playtime-hours'), src: 'audio/click.wav', volume: 0.55 },
    { frame: frameOf('expand-first-review'), src: 'audio/click.wav', volume: 0.6 },
    { frame: frameOf('clear-filters'), src: 'audio/click.wav', volume: 0.6 },
    { frame: themeDark, src: 'audio/click.wav', volume: 0.65 },
    { frame: themeDark + 3, src: 'audio/whoosh.wav', volume: 0.35 },
    { frame: splitStart + 10, src: 'audio/whoosh.wav', volume: 0.4 },
    { frame: splitStart + 70, src: 'audio/tap.wav', volume: 0.55 },
    { frame: splitStart + 134, src: 'audio/click.wav', volume: 0.55 },
    { frame: splitStart + 174, src: 'audio/tap.wav', volume: 0.55 },
    { frame: splitStart + 340, src: 'audio/whoosh.wav', volume: 0.35 },
  ];

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#100f0e',
        overflow: 'hidden',
        fontFamily: '"IBM Plex Sans", sans-serif',
      }}
    >
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

      <AudioLayer totalFrames={durationInFrames} soundEvents={soundEvents} />

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
            freezeAt={Math.max(0, desktopTimeline.totalFrames - 10)}
          />
        </div>
      </div>

      <TitleOverlay durationInFrames={140} />

      <Callout
        title="Tema claro e escuro"
        subtitle="Revelação circular com CSS View Transitions"
        startFrame={theme + 28}
        durationInFrames={span(theme + 28, month - 10)}
      />

      <Callout
        title="Zoom da série mensal"
        subtitle="A barra aproxima o eixo sem filtrar o painel"
        startFrame={month + 36}
        durationInFrames={span(month + 36, monthClick - 20)}
      />

      <Callout
        title="Clique filtrável no gráfico"
        subtitle="O mês recorta KPIs, gráficos e a tabela"
        startFrame={monthClick - 12}
        durationInFrames={span(monthClick - 12, dates - 8)}
      />

      <Callout
        title="Filtro de período na barra lateral"
        subtitle="Presets de ano sincronizados com o gráfico"
        startFrame={dates + 16}
        durationInFrames={span(dates + 16, combo - 16)}
      />

      <Callout
        title="Atalho '/' para busca rápida"
        subtitle="Combobox com filtragem instantânea de jogos"
        startFrame={combo + 8}
        durationInFrames={span(combo + 8, cross - 16)}
      />

      <Callout
        title="Filtragem cruzada sincronizada"
        subtitle="Hover nos tooltips e atualização reativa de KPIs"
        startFrame={cross + 16}
        durationInFrames={span(cross + 16, preset - 16)}
      />

      <Callout
        title="Recortes guiados do estudo"
        subtitle="Acesso a hipóteses empíricas em um clique"
        startFrame={preset + 12}
        durationInFrames={span(preset + 12, table - 16)}
      />

      <Callout
        title="Tabela virtualizada"
        subtitle="Ordenação por votos e horas, rolagem interna e linha expansível"
        startFrame={table + 24}
        durationInFrames={span(table + 24, reset - 16)}
      />

      <Callout
        title="Limpeza de filtros & Volta ao escuro"
        subtitle="Retorno ao estado global auditado"
        startFrame={reset + 16}
        durationInFrames={span(reset + 16, splitStart - 12)}
      />

      <Callout
        title="Experiência mobile fluida"
        subtitle="Gaveta de filtros adaptável e interface responsiva"
        startFrame={splitStart + 10}
        durationInFrames={355}
      />

      <Sequence from={splitStart} durationInFrames={400} layout="none">
        <PhoneFrame durationInFrames={400} />
      </Sequence>

      <EndCard startFrame={endCardStart} />
    </AbsoluteFill>
  );
};
