import React from 'react';
import { Sequence } from 'remotion';
import { Background } from './overview/Background';
import { SceneTransition, OVERLAP_FRAMES } from './overview/SceneTransition';
import { Scene1_Challenge } from './overview/scenes/Scene1_Challenge';
import { Scene2_AgentsMd } from './overview/scenes/Scene2_AgentsMd';
import { Scene3_Architecture } from './overview/scenes/Scene3_Architecture';
import { Scene4_Tokens } from './overview/scenes/Scene4_Tokens';
import { Scene5_Findings } from './overview/scenes/Scene5_Findings';
import { Scene6_Conclusion } from './overview/scenes/Scene6_Conclusion';

const SCENE1_DURATION = 276;
const SCENE2_DURATION = 276;
const SCENE3_DURATION = 366;
const SCENE4_DURATION = 276;
const SCENE5_DURATION = 326;
const SCENE6_DURATION = 190;

const SCENE1_FROM = 0;
const SCENE2_FROM = SCENE1_FROM + SCENE1_DURATION - OVERLAP_FRAMES; // 270
const SCENE3_FROM = SCENE2_FROM + SCENE2_DURATION - OVERLAP_FRAMES; // 540
const SCENE4_FROM = SCENE3_FROM + SCENE3_DURATION - OVERLAP_FRAMES; // 900
const SCENE5_FROM = SCENE4_FROM + SCENE4_DURATION - OVERLAP_FRAMES; // 1170
const SCENE6_FROM = SCENE5_FROM + SCENE5_DURATION - OVERLAP_FRAMES; // 1490

export const OVERVIEW_DURATION = SCENE6_FROM + SCENE6_DURATION; // 1680 frames (28.0s at 60fps)

export const Overview: React.FC = () => {
  return (
    <div style={{ position: 'relative', width: 1920, height: 1080, overflow: 'hidden' }}>
      <Background />

      <Sequence from={SCENE1_FROM} durationInFrames={SCENE1_DURATION}>
        <SceneTransition durationInFrames={SCENE1_DURATION} isFirst>
          <Scene1_Challenge />
        </SceneTransition>
      </Sequence>

      <Sequence from={SCENE2_FROM} durationInFrames={SCENE2_DURATION}>
        <SceneTransition durationInFrames={SCENE2_DURATION}>
          <Scene2_AgentsMd />
        </SceneTransition>
      </Sequence>

      <Sequence from={SCENE3_FROM} durationInFrames={SCENE3_DURATION}>
        <SceneTransition durationInFrames={SCENE3_DURATION}>
          <Scene3_Architecture />
        </SceneTransition>
      </Sequence>

      <Sequence from={SCENE4_FROM} durationInFrames={SCENE4_DURATION}>
        <SceneTransition durationInFrames={SCENE4_DURATION}>
          <Scene4_Tokens />
        </SceneTransition>
      </Sequence>

      <Sequence from={SCENE5_FROM} durationInFrames={SCENE5_DURATION}>
        <SceneTransition durationInFrames={SCENE5_DURATION}>
          <Scene5_Findings />
        </SceneTransition>
      </Sequence>

      <Sequence from={SCENE6_FROM} durationInFrames={SCENE6_DURATION}>
        <SceneTransition durationInFrames={SCENE6_DURATION} isLast>
          <Scene6_Conclusion />
        </SceneTransition>
      </Sequence>
    </div>
  );
};
