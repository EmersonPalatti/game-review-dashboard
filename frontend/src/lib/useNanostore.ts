import { useSyncExternalStore } from 'react';
import type { Metrics } from './api';
import {
  DEFAULT_SORT,
  filters,
  reviewSort,
  type Filters,
  type ReviewSort,
} from '../stores/filters';
import { latestMetrics } from '../stores/metrics';

const serverFilters: Filters = {
  appId: null,
  language: null,
  recommended: 'all',
  steamPurchase: 'all',
  receivedForFree: 'all',
  earlyAccess: 'all',
  playtime: 'all',
};

export function useFilters(): Filters {
  return useSyncExternalStore(filters.subscribe, filters.get, () => serverFilters);
}

export function useReviewSort(): ReviewSort {
  return useSyncExternalStore(reviewSort.subscribe, reviewSort.get, () => DEFAULT_SORT);
}

export function useLatestMetrics(): Metrics | null {
  return useSyncExternalStore(latestMetrics.subscribe, latestMetrics.get, () => null);
}
