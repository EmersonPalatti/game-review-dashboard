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

export const PLAYTIME_LABELS: Record<Exclude<PlaytimeBucket, 'all'>, string> = {
  lt1: 'Menos de 1 h',
  h1_2: '1 a 2 h',
  h2_5: '2 a 5 h',
  h5_10: '5 a 10 h',
  h10_25: '10 a 25 h',
  h25_50: '25 a 50 h',
  h50_100: '50 a 100 h',
  h100_500: '100 a 500 h',
  gte500: '500 h ou mais',
};

export function isPlaytimeBucket(value: string): value is Exclude<PlaytimeBucket, 'all'> {
  return value in PLAYTIME_LABELS;
}

export function getMonthDateRange(month: string): { dateFrom: string; dateTo: string } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthNum = Number(monthStr);
  const lastDay = new Date(year, monthNum, 0).getDate();
  const paddedMonth = String(monthNum).padStart(2, '0');
  const paddedDay = String(lastDay).padStart(2, '0');
  return {
    dateFrom: `${year}-${paddedMonth}-01`,
    dateTo: `${year}-${paddedMonth}-${paddedDay}`,
  };
}

export function getActiveMonth(
  dateFrom: string | null,
  dateTo: string | null,
): string | null {
  if (!dateFrom || !dateTo) return null;
  if (dateFrom.length === 10 && dateTo.length === 10 && dateFrom.slice(0, 7) === dateTo.slice(0, 7)) {
    return dateFrom.slice(0, 7);
  }
  return null;
}

export type Filters = {
  appId: number | null;
  language: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  recommended: Tri;
  steamPurchase: Tri;
  receivedForFree: Tri;
  earlyAccess: Tri;
  playtime: PlaytimeBucket;
};

const initialFilters: Filters = {
  appId: null,
  language: null,
  dateFrom: null,
  dateTo: null,
  recommended: 'all',
  steamPurchase: 'all',
  receivedForFree: 'all',
  earlyAccess: 'all',
  playtime: 'all',
};

export const filters = atom<Filters>({ ...initialFilters });
export const PAGE_SIZE = 20;

export function activeFilterCount(current: Readonly<Filters>): number {
  return [
    current.appId !== null,
    current.language !== null,
    current.dateFrom !== null || current.dateTo !== null,
    current.recommended !== 'all',
    current.steamPurchase !== 'all',
    current.receivedForFree !== 'all',
    current.earlyAccess !== 'all',
    current.playtime !== 'all',
  ].filter(Boolean).length;
}

export type ReviewSortBy = 'created_at' | 'votes_helpful' | 'playtime_hours';
export type SortDir = 'asc' | 'desc';
export type ReviewSort = {
  sortBy: ReviewSortBy;
  sortDir: SortDir;
};

export const DEFAULT_SORT: ReviewSort = {
  sortBy: 'created_at',
  sortDir: 'desc',
};

export const reviewSort = atom<ReviewSort>({ ...DEFAULT_SORT });

export function resetFilters(): void {
  reviewSort.set({ ...DEFAULT_SORT });
  filters.set({ ...initialFilters });
}

function parseTri(value: string | null): Tri {
  if (value === 'yes' || value === 'true') return 'yes';
  if (value === 'no' || value === 'false') return 'no';
  return 'all';
}

function parseSortBy(value: string | null): ReviewSortBy {
  if (value === 'votes_helpful' || value === 'playtime_hours') return value;
  return 'created_at';
}

function parseSortDir(value: string | null): SortDir {
  if (value === 'asc') return 'asc';
  return 'desc';
}

export function readFiltersFromSearch(search: string): {
  filters: Filters;
  sort: ReviewSort;
} {
  const params = new URLSearchParams(search);

  const rawAppId = params.get('app_id');
  const parsedAppId = rawAppId !== null ? parseInt(rawAppId, 10) : NaN;
  const appId = Number.isInteger(parsedAppId) && parsedAppId > 0 ? parsedAppId : null;

  const rawLanguage = params.get('language')?.trim();
  const language = rawLanguage && rawLanguage.length > 0 ? rawLanguage : null;

  const rawPlaytime = params.get('playtime_bucket') ?? '';
  const playtime: PlaytimeBucket = isPlaytimeBucket(rawPlaytime) ? rawPlaytime : 'all';

  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  const rawDateFrom = params.get('date_from');
  const dateFrom = rawDateFrom && DATE_REGEX.test(rawDateFrom) ? rawDateFrom : null;
  const rawDateTo = params.get('date_to');
  const dateTo = rawDateTo && DATE_REGEX.test(rawDateTo) ? rawDateTo : null;

  return {
    filters: {
      appId,
      language,
      dateFrom,
      dateTo,
      recommended: parseTri(params.get('recommended')),
      steamPurchase: parseTri(params.get('steam_purchase')),
      receivedForFree: parseTri(params.get('received_for_free')),
      earlyAccess: parseTri(params.get('early_access')),
      playtime,
    },
    sort: {
      sortBy: parseSortBy(params.get('sort_by')),
      sortDir: parseSortDir(params.get('sort_dir')),
    },
  };
}

export function writeFiltersToSearch(
  current: Readonly<Filters>,
  currentSort: Readonly<ReviewSort> = DEFAULT_SORT,
): string {
  const params = new URLSearchParams();

  if (current.appId !== null) {
    params.set('app_id', String(current.appId));
  }

  if (current.language !== null && current.language.trim() !== '') {
    params.set('language', current.language.trim());
  }

  if (current.dateFrom !== null) {
    params.set('date_from', current.dateFrom);
  }

  if (current.dateTo !== null) {
    params.set('date_to', current.dateTo);
  }

  if (current.recommended !== 'all') {
    params.set('recommended', current.recommended);
  }

  if (current.steamPurchase !== 'all') {
    params.set('steam_purchase', current.steamPurchase);
  }

  if (current.receivedForFree !== 'all') {
    params.set('received_for_free', current.receivedForFree);
  }

  if (current.earlyAccess !== 'all') {
    params.set('early_access', current.earlyAccess);
  }

  if (current.playtime !== 'all') {
    params.set('playtime_bucket', current.playtime);
  }

  if (currentSort.sortBy !== DEFAULT_SORT.sortBy || currentSort.sortDir !== DEFAULT_SORT.sortDir) {
    params.set('sort_by', currentSort.sortBy);
    params.set('sort_dir', currentSort.sortDir);
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}
