import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import './chatUpgrade/fonts';
import { PortraitBackground } from './chatUpgrade/components/PortraitBackground';
import { SceneTransition } from './overview/SceneTransition';
import { CANVAS } from './chatUpgrade/tokens';
import { SCENE_DURATIONS, SCENE_FROM, SceneKey } from './chatUpgrade/timing';
import { ChatUpgradeAudio } from './chatUpgrade/ChatUpgradeAudio';
import { Scene0_Hook } from './chatUpgrade/scenes/Scene0_Hook';
import { Scene1_Before } from './chatUpgrade/scenes/Scene1_Before';
import { Scene2_Engine } from './chatUpgrade/scenes/Scene2_Engine';
import { Scene3_Catalog } from './chatUpgrade/scenes/Scene3_Catalog';
import { Scene4_Search } from './chatUpgrade/scenes/Scene4_Search';
import { Scene5_Live } from './chatUpgrade/scenes/Scene5_Live';
import { Scene6_Proof } from './chatUpgrade/scenes/Scene6_Proof';
import { Scene7_Close } from './chatUpgrade/scenes/Scene7_Close';

export { CHAT_UPGRADE_DURATION } from './chatUpgrade/timing';

export const SCENE_COMPONENTS: Record<SceneKey, React.FC> = {
  hook: Scene0_Hook,
  before: Scene1_Before,
  engine: Scene2_Engine,
  catalog: Scene3_Catalog,
  search: Scene4_Search,
  live: Scene5_Live,
  proof: Scene6_Proof,
  close: Scene7_Close,
};

const SceneSlot: React.FC<{ id: SceneKey; isFirst?: boolean; isLast?: boolean }> = ({
  id,
  isFirst,
  isLast,
}) => {
  const Scene = SCENE_COMPONENTS[id];
  return (
    <Sequence name={id} from={SCENE_FROM[id]} durationInFrames={SCENE_DURATIONS[id]}>
      <SceneTransition durationInFrames={SCENE_DURATIONS[id]} isFirst={isFirst} isLast={isLast}>
        <Scene />
      </SceneTransition>
    </Sequence>
  );
};

/** SteamBot-9000 v2 · motion vídeo 4:5 para o LinkedIn (roteiro em video/roteiro-chat-v2.md). */
export const ChatUpgrade: React.FC = () => (
  <AbsoluteFill style={{ width: CANVAS.width, height: CANVAS.height, overflow: 'hidden' }}>
    <PortraitBackground />
    <SceneSlot id="hook" isFirst />
    <SceneSlot id="before" />
    <SceneSlot id="engine" />
    <SceneSlot id="catalog" />
    <SceneSlot id="search" />
    <SceneSlot id="live" />
    <SceneSlot id="proof" />
    <SceneSlot id="close" isLast />
    <ChatUpgradeAudio />
  </AbsoluteFill>
);

/** Uma cena isolada, para pré-visualizar e gerar stills sem renderizar o vídeo todo. */
export const ChatUpgradeScene: React.FC<{ scene: SceneKey }> = ({ scene }) => {
  const Scene = SCENE_COMPONENTS[scene];
  return (
    <AbsoluteFill style={{ width: CANVAS.width, height: CANVAS.height, overflow: 'hidden' }}>
      <PortraitBackground />
      <SceneTransition durationInFrames={SCENE_DURATIONS[scene]} isFirst isLast>
        <Scene />
      </SceneTransition>
    </AbsoluteFill>
  );
};
