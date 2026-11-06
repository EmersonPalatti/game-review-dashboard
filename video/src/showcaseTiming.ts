import desktopTimelineRaw from '../public/desktop.timeline.json';
import { TimelineData, TimelineEvent } from './types';

export const desktopTimeline = desktopTimelineRaw as unknown as TimelineData;

export function frameOf(name: string): number {
  const event = desktopTimeline.events.find((item: TimelineEvent) => item.name === name);
  if (!event) {
    throw new Error(`Evento ausente no timeline do showcase: ${name}`);
  }
  return event.frame;
}

const themeDark = frameOf('theme-toggle-dark');

/** O celular entra durante a volta ao tema escuro, como na tomada anterior. */
export const splitStart = themeDark + 35;
export const endCardStart = splitStart + 365;
export const SHOWCASE_DURATION = endCardStart + 135;
