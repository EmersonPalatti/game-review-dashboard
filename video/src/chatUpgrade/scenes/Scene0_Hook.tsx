import React from 'react';
import { useCurrentFrame } from 'remotion';
import { enterUp } from '../anim';
import { SceneShell } from '../components/SceneShell';
import { ChatClip } from '../footage/ChatClip';
import { CONTENT } from '../tokens';

/**
 * Cena 0 · Gancho (210 frames). O resultado antes da explicação: a tomada real
 * do v2 com a timeline de ferramentas e o widget comparativo entrando.
 */
export const Scene0_Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const clipIn = enterUp(frame, 0, 22, 20);

  return (
    <SceneShell kicker="SteamBot-9000 · v1 → v2" headline="Reconstruímos o chat do dashboard.">
      <div style={{ ...clipIn }}>
        <ChatClip
          take="compare"
          at="widget"
          offset={-2.3}
          showCursor={false}
          camera={[
            { frame: 0, x: 1500, y: 395, w: 420 },
            { frame: 210, x: 1516, y: 402, w: 388 },
          ]}
          width={CONTENT.width}
          height={CONTENT.height}
        />
      </div>
    </SceneShell>
  );
};
