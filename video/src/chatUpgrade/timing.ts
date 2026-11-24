import { OVERLAP_FRAMES } from '../overview/SceneTransition';

export const FPS = 60;

/** Duração de cada cena em frames (60 fps). Ver a linha do tempo do roteiro. */
export const SCENE_DURATIONS = {
  hook: 210,
  // As cenas seguram o estado final por mais tempo para dar leitura no mudo
  // (a linha do porquê fica pelo menos ~2,5 s na tela).
  before: 390,
  engine: 390,
  catalog: 390,
  search: 420,
  live: 570,
  proof: 390,
  close: 270,
} as const;

export type SceneKey = keyof typeof SCENE_DURATIONS;

export const SCENE_ORDER: SceneKey[] = [
  'hook',
  'before',
  'engine',
  'catalog',
  'search',
  'live',
  'proof',
  'close',
];

/** Frame de início de cada cena na composição inteira (com sobreposição de 6 frames). */
export const SCENE_FROM: Record<SceneKey, number> = (() => {
  const result = {} as Record<SceneKey, number>;
  let cursor = 0;
  for (const key of SCENE_ORDER) {
    result[key] = cursor;
    cursor += SCENE_DURATIONS[key] - OVERLAP_FRAMES;
  }
  return result;
})();

const lastKey = SCENE_ORDER[SCENE_ORDER.length - 1];

/** 2988 frames = 49,8 s. */
export const CHAT_UPGRADE_DURATION = SCENE_FROM[lastKey] + SCENE_DURATIONS[lastKey];
