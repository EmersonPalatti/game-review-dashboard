import { atom } from 'nanostores';

export type Tri = 'all' | 'yes' | 'no';

export type PlaytimeBucket =
  | 'all'
  | 'lt1'
  | 'h1_2'
  | 'h2_5'
  | 'h5_10'
  | 'h10_25'
  | 'h25_50'
  | 'h50_100'
  | 'h100_500'
  | 'gte500';

export type Filters = {
  appId: number | null;
  language: string | null;
  recommended: Tri;
  steamPurchase: Tri;
  receivedForFree: Tri;
  earlyAccess: Tri;
  playtime: PlaytimeBucket;
};

const initialFilters: Filters = {
  appId: null,
  language: null,
  recommended: 'all',
  steamPurchase: 'all',
  receivedForFree: 'all',
  earlyAccess: 'all',
  playtime: 'all',
};

export const filters = atom<Filters>({ ...initialFilters });
export const page = atom(0);
export const PAGE_SIZE = 20;

export function resetFilters(): void {
  filters.set({ ...initialFilters });
  page.set(0);
}
