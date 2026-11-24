import React from 'react';
import { Audio, interpolate, Sequence, staticFile, useVideoConfig } from 'remotion';
import { SCENE_FROM } from './timing';

/**
 * Áudio mínimo: trilha baixa e 3 efeitos. O vídeo precisa funcionar no mudo.
 * Frames sincronizados com a tomada T2 na cena 5: o widget entra em ~f96 do
 * trecho contínuo e o clique no chip cai 1,2 s depois do início do trecho do chip (f360).
 */
export interface SfxEvent {
  name: string;
  frame: number;
  src: string;
  volume: number;
}

export const SFX_EVENTS: SfxEvent[] = [
  { name: 'widget na resposta', frame: SCENE_FROM.live + 96, src: 'audio/tap.wav', volume: 0.25 },
  { name: 'chip de filtro', frame: SCENE_FROM.live + 432, src: 'audio/click.wav', volume: 0.4 },
  { name: 'fechamento', frame: SCENE_FROM.close, src: 'audio/whoosh.wav', volume: 0.18 },
];

const BED_VOLUME = 0.12;

/** Trilha + efeitos. `events` troca os efeitos (a versão 100% motion tem outra linha do tempo). */
export const ChatUpgradeAudio: React.FC<{ events?: SfxEvent[] }> = ({ events = SFX_EVENTS }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <>
      <Audio
        src={staticFile('audio/lofi2_bg.mp3')}
        volume={(f) =>
          interpolate(
            f,
            [0, 1 * fps, durationInFrames - 2 * fps, durationInFrames],
            [0, BED_VOLUME, BED_VOLUME, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          )
        }
      />
      {events.map((evt) => (
        <Sequence key={evt.name} name={`sfx: ${evt.name}`} from={evt.frame} durationInFrames={2 * fps}>
          <Audio src={staticFile(evt.src)} volume={evt.volume} />
        </Sequence>
      ))}
    </>
  );
};
