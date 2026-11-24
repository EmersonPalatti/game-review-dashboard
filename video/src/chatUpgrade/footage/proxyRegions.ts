/**
 * Regiões recortadas de cada tomada, em px CSS do viewport de captura (1920 × 1080).
 * Usado por capture/make-proxies.ts (para gerar os vídeos) e pelo ChatClip (para
 * posicionar o recorte). Larguras e alturas pares, exigência do H.264.
 */
export interface ProxyRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Px do proxy por px CSS. Padrão: 2 (a resolução da captura). */
  outScale?: number;
}

export const PROXY_REGIONS = {
  v1: {
    chat: { x: 1480, y: 0, w: 440, h: 1080 },
  },
  'v2-search': {
    chat: { x: 1480, y: 0, w: 440, h: 1080 },
  },
  'v2-compare': {
    chat: { x: 1480, y: 0, w: 440, h: 1080 },
    kpi: { x: 280, y: 180, w: 640, h: 280 },
    // App inteiro, para o plano aberto da versão 100% motion. Em 1×: o quadro
    // mostra a página com ~1000 px de largura, então 4K só pesaria na decodificação.
    full: { x: 0, y: 0, w: 1920, h: 1080, outScale: 1 },
  },
} as const satisfies Record<string, Record<string, ProxyRegion>>;

export type ProxyTake = keyof typeof PROXY_REGIONS;
