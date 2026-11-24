import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import './chatUpgrade/fonts';
import { PortraitBackground } from './chatUpgrade/components/PortraitBackground';
import { SceneTransition } from './overview/SceneTransition';
import { CANVAS } from './chatUpgrade/tokens';
import { ChatUpgradeAudio, SfxEvent } from './chatUpgrade/ChatUpgradeAudio';
import { MOTION_DURATIONS, MOTION_FROM, MOTION_ORDER, MotionSceneKey } from './chatUpgrade/motion/timing';
import { M0_Hook } from './chatUpgrade/motion/M0_Hook';
import { M1_Before } from './chatUpgrade/motion/M1_Before';
import { Scene2_Engine } from './chatUpgrade/scenes/Scene2_Engine';
import { Scene3_Catalog } from './chatUpgrade/scenes/Scene3_Catalog';
import { M4_Search } from './chatUpgrade/motion/M4_Search';
import { M5_Live, M5_SFX } from './chatUpgrade/motion/M5_Live';
import { Scene6_Proof } from './chatUpgrade/scenes/Scene6_Proof';
import { M7_Real, M7_SFX } from './chatUpgrade/motion/M7_Real';
import { Scene7_Close } from './chatUpgrade/scenes/Scene7_Close';

export { CHAT_UPGRADE_MOTION_DURATION } from './chatUpgrade/motion/timing';

export const MOTION_SCENES: Record<MotionSceneKey, React.FC> = {
  hook: M0_Hook,
  before: M1_Before,
  engine: Scene2_Engine,
  catalog: Scene3_Catalog,
  search: M4_Search,
  live: M5_Live,
  proof: Scene6_Proof,
  real: M7_Real,
  close: Scene7_Close,
};

/** Efeitos sonoros: frames locais das cenas convertidos para a composição inteira. */
const MOTION_SFX: SfxEvent[] = [
  ...M5_SFX.map((e) => ({ ...e, frame: MOTION_FROM.live + e.frame })),
  ...M7_SFX.map((e) => ({ ...e, frame: MOTION_FROM.real + e.frame })),
  { name: 'fechamento', frame: MOTION_FROM.close, src: 'audio/whoosh.wav', volume: 0.18 },
];

/**
 * SteamBot-9000 v2 · versão 100% motion (4:5, LinkedIn). A interface do chat é
 * redesenhada em motion com os textos, tempos e números das execuções reais
 * (chatUpgrade/mock/data.ts). A única tomada real fica no fim, na cena "real".
 */
export const ChatUpgradeMotion: React.FC = () => (
  <AbsoluteFill style={{ width: CANVAS.width, height: CANVAS.height, overflow: 'hidden' }}>
    <PortraitBackground />
    {MOTION_ORDER.map((id, i) => {
      const Scene = MOTION_SCENES[id];
      return (
        <Sequence key={id} name={id} from={MOTION_FROM[id]} durationInFrames={MOTION_DURATIONS[id]}>
          <SceneTransition
            durationInFrames={MOTION_DURATIONS[id]}
            isFirst={i === 0}
            isLast={i === MOTION_ORDER.length - 1}
          >
            <Scene />
          </SceneTransition>
        </Sequence>
      );
    })}
    <ChatUpgradeAudio events={MOTION_SFX} />
  </AbsoluteFill>
);

/** Uma cena isolada da versão motion, para pré-visualizar e gerar stills. */
export const ChatUpgradeMotionScene: React.FC<{ scene: MotionSceneKey }> = ({ scene }) => {
  const Scene = MOTION_SCENES[scene];
  return (
    <AbsoluteFill style={{ width: CANVAS.width, height: CANVAS.height, overflow: 'hidden' }}>
      <PortraitBackground />
      <SceneTransition durationInFrames={MOTION_DURATIONS[scene]} isFirst isLast>
        <Scene />
      </SceneTransition>
    </AbsoluteFill>
  );
};
