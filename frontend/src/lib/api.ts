import { DEFAULT_SORT, PAGE_SIZE, type Filters, type ReviewSort, type Tri } from '../stores/filters';

export const REVIEW_WINDOW = 100;

export type GameMetric = {
  app_id: number;
  app_name: string;
  review_count: number;
};

export type LanguageMetric = {
  language: string;
  review_count: number;
};

export type Metrics = {
  total_reviews: number;
  recommendation_rate: number;
  game_count: number;
  author_count: number;
  games: GameMetric[];
  languages: LanguageMetric[];
};

export type ReviewItem = {
  review_id: number;
  app_id: number;
  app_name: string;
  language: string;
  recommended: boolean;
  votes_helpful: number;
  votes_funny: number;
  comment_count: number;
  playtime_at_review_hours: number | null;
  steam_purchase: boolean;
  received_for_free: boolean;
  early_access: boolean;
  created_at: string;
  excerpt: string;
};

export type ReviewsPage = {
  total: number;
  limit: number;
  offset: number;
  items: ReviewItem[];
};

export type PlaytimePoint = {
  key: string;
  label: string;
  review_count: number;
  recommendation_rate: number | null;
};

export type GameBar = {
  app_name: string;
  review_count: number;
};

export type LanguageBar = {
  language: string;
  review_count: number;
  recommendation_rate: number | null;
};

export type MonthPoint = {
  month: string;
  review_count: number;
};

export type Charts = {
  playtime: PlaytimePoint[];
  games: GameBar[];
  languages: LanguageBar[];
  months: MonthPoint[];
};

function setTri(params: URLSearchParams, key: string, value: Tri): void {
  if (value === 'yes') params.set(key, 'true');
  if (value === 'no') params.set(key, 'false');
}

function appendFilters(params: URLSearchParams, current: Readonly<Filters>): void {
  if (current.appId !== null && Number.isFinite(current.appId)) {
    params.set('app_id', String(current.appId));
  }
  if (current.language) {
    params.set('language', current.language);
  }
  if (current.dateFrom) {
    params.set('date_from', current.dateFrom);
  }
  if (current.dateTo) {
    params.set('date_to', current.dateTo);
  }
  setTri(params, 'recommended', current.recommended);
  setTri(params, 'steam_purchase', current.steamPurchase);
  setTri(params, 'received_for_free', current.receivedForFree);
  setTri(params, 'early_access', current.earlyAccess);
  if (current.playtime !== 'all') {
    params.set('playtime_bucket', current.playtime);
  }
}

export const API_BASE = import.meta.env.PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Resposta ${response.status} para ${url}`);
  }
  return (await response.json()) as T;
}

export function fetchMetrics(current: Readonly<Filters>): Promise<Metrics> {
  const params = new URLSearchParams();
  appendFilters(params, current);
  const query = params.toString();
  return requestJson<Metrics>(query ? `${API_BASE}/api/summary?${query}` : `${API_BASE}/api/summary`);
}

export function fetchCharts(current: Readonly<Filters>): Promise<Charts> {
  const params = new URLSearchParams();
  appendFilters(params, current);
  const query = params.toString();
  return requestJson<Charts>(query ? `${API_BASE}/api/charts?${query}` : `${API_BASE}/api/charts`);
}

export function fetchReviewWindow(
  current: Readonly<Filters>,
  offset: number,
  sort: Readonly<ReviewSort> = DEFAULT_SORT,
  limit = REVIEW_WINDOW,
): Promise<ReviewsPage> {
  const params = new URLSearchParams();
  appendFilters(params, current);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  if (sort.sortBy !== DEFAULT_SORT.sortBy || sort.sortDir !== DEFAULT_SORT.sortDir) {
    params.set('sort_by', sort.sortBy);
    params.set('sort_dir', sort.sortDir);
  }
  return requestJson<ReviewsPage>(`${API_BASE}/api/reviews?${params.toString()}`);
}

export function fetchReviews(
  current: Readonly<Filters>,
  pageIndex: number,
  sort: Readonly<ReviewSort> = DEFAULT_SORT,
): Promise<ReviewsPage> {
  return fetchReviewWindow(current, pageIndex * PAGE_SIZE, sort, PAGE_SIZE);
}

export type ChatRole = 'user' | 'assistant';

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type ChatFiltersPayload = {
  app_id: number | null;
  language: string | null;
  recommended: boolean | null;
  steam_purchase: boolean | null;
  received_for_free: boolean | null;
  early_access: boolean | null;
  playtime_bucket: string | null;
  date_from: string | null;
  date_to: string | null;
};

export type ChatRequestPayload = {
  message: string;
  filters: ChatFiltersPayload;
  history: ChatHistoryItem[];
};

export type ChatResponsePayload = {
  reply: string;
  model: string;
  tools_used: string[];
};

function triToBoolean(value: Tri): boolean | null {
  if (value === 'yes') return true;
  if (value === 'no') return false;
  return null;
}

export function toChatFiltersPayload(current: Readonly<Filters>): ChatFiltersPayload {
  return {
    app_id: current.appId !== null && Number.isFinite(current.appId) ? current.appId : null,
    language: current.language || null,
    recommended: triToBoolean(current.recommended),
    steam_purchase: triToBoolean(current.steamPurchase),
    received_for_free: triToBoolean(current.receivedForFree),
    early_access: triToBoolean(current.earlyAccess),
    playtime_bucket: current.playtime !== 'all' ? current.playtime : null,
    date_from: current.dateFrom || null,
    date_to: current.dateTo || null,
  };
}

export async function sendChatMessage(
  message: string,
  current: Readonly<Filters>,
  history: ChatHistoryItem[] = [],
  signal?: AbortSignal,
): Promise<ChatResponsePayload> {
  const payload: ChatRequestPayload = {
    message,
    filters: toChatFiltersPayload(current),
    history,
  };

  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const detail = errorData?.detail;
    throw new Error(detail || `Erro ${response.status} ao consultar o agente.`);
  }

  return (await response.json()) as ChatResponsePayload;
}

