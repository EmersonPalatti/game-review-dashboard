import { OVERLAP_FRAMES } from '../../overview/SceneTransition';

/**
 * Linha do tempo da versão 100% motion (composição ChatUpgradeMotion).
 * As cenas 2, 3, 6 e 7 são as mesmas do híbrido; 0, 1, 4 e 5 trocam as tomadas
 * por interface redesenhada em motion; "real" é o único trecho com tomada real,
 * no fim, mostrando o chat dentro do app.
 */
export const MOTION_DURATIONS = {
  hook: 240,
  before: 420,
  engine: 390,
  catalog: 390,
  search: 480,
  live: 600,
  proof: 390,
  real: 540,
  close: 270,
} as const;

export type MotionSceneKey = keyof typeof MOTION_DURATIONS;

export const MOTION_ORDER: MotionSceneKey[] = [
  'hook',
  'before',
  'engine',
  'catalog',
  'search',
  'live',
  'proof',
  'real',
  'close',
];

/** Frame de início de cada cena na composição inteira (com sobreposição de 6 frames). */
export const MOTION_FROM: Record<MotionSceneKey, number> = (() => {
  const result = {} as Record<MotionSceneKey, number>;
  let cursor = 0;
  for (const key of MOTION_ORDER) {
    result[key] = cursor;
    cursor += MOTION_DURATIONS[key] - OVERLAP_FRAMES;
  }
  return result;
})();

const lastKey = MOTION_ORDER[MOTION_ORDER.length - 1];

/** 3672 frames ≈ 61,2 s. */
export const CHAT_UPGRADE_MOTION_DURATION = MOTION_FROM[lastKey] + MOTION_DURATIONS[lastKey];
