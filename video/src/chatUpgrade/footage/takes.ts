import v1Raw from '../../../public/chat/chat-v1.timeline.json';
import searchRaw from '../../../public/chat/chat-v2-search.timeline.json';
import compareRaw from '../../../public/chat/chat-v2-compare.timeline.json';
import type { TimelineData } from '../../types';
import { PROXY_REGIONS, ProxyRegion, ProxyTake } from './proxyRegions';

/** Tomadas reais do chat (gravadas por capture/chat-takes.ts). */
export type TakeId = 'v1' | 'search' | 'compare';

/** Recorte da tomada usado no quadro (ver proxyRegions.ts). */
export type ClipSource = 'chat' | 'kpi' | 'full';

interface TakeInfo {
  proxy: ProxyTake;
  timeline: TimelineData;
  /** Velocidade dos trechos acelerados quando o mark não traz o valor (fast-start:N). */
  defaultFastSpeed: number;
}

export const TAKES: Record<TakeId, TakeInfo> = {
  v1: { proxy: 'v1', timeline: v1Raw as unknown as TimelineData, defaultFastSpeed: 1 },
  search: { proxy: 'v2-search', timeline: searchRaw as unknown as TimelineData, defaultFastSpeed: 4 },
  compare: { proxy: 'v2-compare', timeline: compareRaw as unknown as TimelineData, defaultFastSpeed: 4 },
};

/** Px do vídeo por px CSS da página capturada (deviceScaleFactor 2). */
export const CAPTURE_SCALE = 2;

/** Arquivo e região CSS do recorte pedido. */
export function proxyFor(take: TakeId, source: ClipSource): { src: string; region: ProxyRegion } {
  const proxy = TAKES[take].proxy;
  const regions = PROXY_REGIONS[proxy] as Record<string, ProxyRegion>;
  const region = regions[source];
  if (!region) throw new Error(`Tomada ${take} não tem o recorte "${source}"`);
  return { src: `chat/chat-${proxy}-${source}.mp4`, region };
}

/** Frame do vídeo da tomada em que o mark aconteceu. */
export function markFrame(take: TakeId, name: string): number {
  const event = TAKES[take].timeline.events.find((e) => e.name === name);
  if (!event) throw new Error(`Mark "${name}" ausente na tomada ${take}`);
  return event.frame;
}

/** Trechos gravados em velocidade acelerada: [início, fim) em frames do vídeo e a velocidade. */
export function fastSegments(take: TakeId): { from: number; to: number; speed: number }[] {
  const { events } = TAKES[take].timeline;
  const segments: { from: number; to: number; speed: number }[] = [];
  let open: { from: number; speed: number } | null = null;
  for (const e of events) {
    if (e.name.startsWith('fast-start')) {
      const [, speed] = e.name.split(':');
      open = { from: e.frame, speed: speed ? Number(speed) : TAKES[take].defaultFastSpeed };
    } else if (e.name === 'fast-end' && open) {
      segments.push({ ...open, to: e.frame });
      open = null;
    }
  }
  return segments;
}
