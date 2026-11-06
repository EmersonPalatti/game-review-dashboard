import React from 'react';
import { Composition } from 'remotion';
import { Showcase } from './Showcase';
import { SHOWCASE_DURATION } from './showcaseTiming';
import { Overview, OVERVIEW_DURATION } from './Overview';

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
    </>
  );
};
