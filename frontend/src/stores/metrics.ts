import { atom } from 'nanostores';
import type { Metrics } from '../lib/api';

export const latestMetrics = atom<Metrics | null>(null);
