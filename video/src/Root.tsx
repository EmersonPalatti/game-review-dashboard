import React from 'react';
import { Composition, Folder } from 'remotion';
import { Showcase } from './Showcase';
import { SHOWCASE_DURATION } from './showcaseTiming';
import { Overview, OVERVIEW_DURATION } from './Overview';
import { CHAT_UPGRADE_DURATION, ChatUpgrade, ChatUpgradeScene } from './ChatUpgrade';
import { CANVAS } from './chatUpgrade/tokens';
import { SCENE_DURATIONS, SCENE_ORDER } from './chatUpgrade/timing';
import { CHAT_UPGRADE_MOTION_DURATION, ChatUpgradeMotion, ChatUpgradeMotionScene } from './ChatUpgradeMotion';
import { MOTION_DURATIONS, MOTION_ORDER } from './chatUpgrade/motion/timing';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="Showcase"
        component={Showcase}
        durationInFrames={SHOWCASE_DURATION}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="Overview"
        component={Overview}
        durationInFrames={OVERVIEW_DURATION}
        fps={60}
        width={1920}
        height={1080}
      />
      <Composition
        id="ChatUpgrade"
        component={ChatUpgrade}
        durationInFrames={CHAT_UPGRADE_DURATION}
        fps={60}
        width={CANVAS.width}
        height={CANVAS.height}
      />
      <Folder name="ChatUpgradeScenes">
        {SCENE_ORDER.map((scene) => (
          <Composition
            key={scene}
            id={`ChatUpgrade-${scene}`}
            component={ChatUpgradeScene}
            defaultProps={{ scene }}
            durationInFrames={SCENE_DURATIONS[scene]}
            fps={60}
            width={CANVAS.width}
            height={CANVAS.height}
          />
        ))}
      </Folder>
      <Composition
        id="ChatUpgradeMotion"
        component={ChatUpgradeMotion}
        durationInFrames={CHAT_UPGRADE_MOTION_DURATION}
        fps={60}
        width={CANVAS.width}
        height={CANVAS.height}
      />
      <Folder name="ChatUpgradeMotionScenes">
        {MOTION_ORDER.map((scene) => (
          <Composition
            key={scene}
            id={`ChatUpgradeMotion-${scene}`}
            component={ChatUpgradeMotionScene}
            defaultProps={{ scene }}
            durationInFrames={MOTION_DURATIONS[scene]}
            fps={60}
            width={CANVAS.width}
            height={CANVAS.height}
          />
        ))}
      </Folder>
    </>
  );
};
