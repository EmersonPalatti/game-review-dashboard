import {
  fetchCharts,
  fetchMetrics,
  fetchReviews,
  type Charts,
  type GameBar,
  type LanguageBar,
  type Metrics,
  type ReviewsPage,
} from '../lib/api';
import {
  BASELINE_AUTHORS,
  BASELINE_GAMES,
  BASELINE_PERIOD_SHORT,
  BASELINE_RATE,
  BASELINE_REVIEWS,
  PLACEHOLDER,
  PLAYTIME_OPTIONS,
  PRESETS,
  activePresetNote,
  isPresetActive,
  type PresetKey,
} from '../lib/constants';
import { formatHours, formatInteger, formatPercent, languageLabel } from '../lib/format';
import {
  DEFAULT_SORT,
  PLAYTIME_LABELS,
  filters,
  page,
  readFiltersFromSearch,
  resetFilters,
  reviewSort,
  writeFiltersToSearch,
  type Filters,
  type PlaytimeBucket,
  type ReviewSort,
  type ReviewSortBy,
  type Tri,
} from '../stores/filters';
import { initCharts, renderCharts, repaintCharts } from './charts';
import { SearchCombo, type ComboOption } from './combo';
import {
  rankRow,
  renderEmptyReviewRow,
  renderFilterChips,
  renderReviewRow,
  type FilterChip,
} from './renderers';
import { setupTheme } from './theme';

function requireElement<T extends Element>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Elemento não encontrado: ${id}`);
  }
  return element;
}

function ease(amount: number): number {
  let t = amount;
  for (let step = 0; step < 6; step += 1) {
    const u = 1 - t;
    const x = 3 * u * u * t * 0.22 + 3 * u * t * t * 0.36 + t * t * t;
    const slope = 3 * u * u * 0.22 + 6 * u * t * (0.36 - 0.22) + 3 * t * t * (1 - 0.36);
    if (Math.abs(slope) < 1e-4) break;
    t = Math.min(1, Math.max(0, t - (x - amount) / slope));
  }
  const u = 1 - t;
  return 3 * u * u * t * 1 + 3 * u * t * t * 1 + t * t * t;
}

const main = requireElement('dashboard-main', HTMLElement);
const form = requireElement('filters-form', HTMLFormElement);
const appInput = requireElement('filter-app', HTMLInputElement);
const appMenu = requireElement('filter-app-list', HTMLUListElement);
const languageInput = requireElement('filter-language', HTMLInputElement);
const languageMenu = requireElement('filter-language-list', HTMLUListElement);
const clearButton = requireElement('clear-filters', HTMLButtonElement);
const themeButton = requireElement('theme-toggle', HTMLButtonElement);
const sidebarPanel = requireElement('app-sidebar', HTMLElement);
const sidebarOpenButton = requireElement('sidebar-open', HTMLButtonElement);
const sidebarCloseButton = requireElement('sidebar-close', HTMLButtonElement);
const sidebarQuery = window.matchMedia('(max-width: 767px)');

function syncMobileSidebar(): void {
  const open = sidebarPanel.classList.contains('is-open');
  sidebarPanel.inert = sidebarQuery.matches && !open;
  main.inert = sidebarQuery.matches && open;
  sidebarOpenButton.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function setMobileSidebar(open: boolean): void {
  const wasOpen = sidebarPanel.classList.contains('is-open');
  sidebarPanel.classList.toggle('is-open', open);
  syncMobileSidebar();
  if (sidebarQuery.matches) {
    if (open && !wasOpen) sidebarCloseButton.focus();
    else if (!open && wasOpen) sidebarOpenButton.focus();
  }
}

sidebarOpenButton.addEventListener('click', () => {
  setMobileSidebar(!sidebarPanel.classList.contains('is-open'));
});
sidebarCloseButton.addEventListener('click', () => {
  setMobileSidebar(false);
});
sidebarQuery.addEventListener('change', () => {
  if (!sidebarQuery.matches) sidebarPanel.classList.remove('is-open');
  syncMobileSidebar();
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !sidebarPanel.classList.contains('is-open')) return;
  if (sidebarPanel.querySelector('.combo-menu.is-open')) return;
  setMobileSidebar(false);
});
syncMobileSidebar();

const filterSummary = requireElement('filter-summary', HTMLElement);
const activeChips = requireElement('active-chips', HTMLElement);
const contextSubtitle = requireElement('context-subtitle', HTMLElement);
const errorBanner = requireElement('load-error', HTMLElement);
const loadErrorDetail = requireElement('load-error-detail', HTMLElement);
const retryButton = requireElement('retry', HTMLButtonElement);
const metricReviews = requireElement('metric-reviews', HTMLElement);
const metricReviewsSub = requireElement('metric-reviews-sub', HTMLElement);
const metricRecommendation = requireElement('metric-recommendation', HTMLElement);
const metricRecommendationSub = requireElement('metric-recommendation-sub', HTMLElement);
const metricGames = requireElement('metric-games', HTMLElement);
const metricGamesSub = requireElement('metric-games-sub', HTMLElement);
const metricAuthors = requireElement('metric-authors', HTMLElement);
const metricAuthorsSub = requireElement('metric-authors-sub', HTMLElement);
const rankGames = requireElement('rank-games', HTMLOListElement);
const rankLanguages = requireElement('rank-languages', HTMLOListElement);
const reviewsBody = requireElement('reviews-body', HTMLTableSectionElement);
const pageRange = requireElement('page-range', HTMLElement);
const prevButton = requireElement('page-prev', HTMLButtonElement);
const nextButton = requireElement('page-next', HTMLButtonElement);

const appCombo = new SearchCombo(appInput, appMenu, (value) => {
  const appId = value === '' ? null : Number(value);
  patchFilters({ appId: appId !== null && Number.isFinite(appId) ? appId : null });
});

const languageCombo = new SearchCombo(languageInput, languageMenu, (value) => {
  patchFilters({ language: value === '' ? null : value });
});

function choiceCombo(
  id: string,
  empty: ComboOption,
  options: ComboOption[],
  onCommit: (value: string) => void,
): SearchCombo {
  const combo = new SearchCombo(
    requireElement(id, HTMLInputElement),
    requireElement(`${id}-list`, HTMLUListElement),
    onCommit,
    empty,
  );
  combo.setOptions(options);
  return combo;
}

function readPlaytime(value: string): PlaytimeBucket {
  switch (value) {
    case 'lt1':
    case 'h1_2':
    case 'h2_5':
    case 'h5_10':
    case 'h10_25':
    case 'h25_50':
    case 'h50_100':
    case 'h100_500':
    case 'gte500':
      return value;
    default:
      return 'all';
  }
}

const playtimeCombo = choiceCombo(
  'filter-playtime',
  { value: 'all', label: 'Todos' },
  PLAYTIME_OPTIONS,
  (value) => {
    patchFilters({ playtime: readPlaytime(value) });
  },
);

let requestId = 0;
let busyTimer = 0;
let gamesSignature = '';
let languagesSignature = '';
const appIdByName = new Map<string, number>();
const gameNameById = new Map<number, string>();
let syncingFromPopState = false;

let baselineReviews = BASELINE_REVIEWS;
let baselineRate = BASELINE_RATE;
let baselineGames = BASELINE_GAMES;
let baselineAuthors = BASELINE_AUTHORS;

const ppFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

type Figure = {
  element: HTMLElement;
  value: number | null;
  format: (value: number) => string;
};

const figures: Record<string, Figure> = {
  reviews: { element: metricReviews, value: null, format: (value) => formatInteger(value) },
  recommendation: {
    element: metricRecommendation,
    value: null,
    format: (value) => formatPercent(value),
  },
  games: { element: metricGames, value: null, format: (value) => formatInteger(value) },
  authors: { element: metricAuthors, value: null, format: (value) => formatInteger(value) },
};

function readTri(value: string): Tri {
  if (value === 'yes' || value === 'no') return value;
  return 'all';
}

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
}

function activeFilterCount(current: Filters): number {
  return [
    current.appId !== null,
    current.language !== null,
    current.recommended !== 'all',
    current.steamPurchase !== 'all',
    current.receivedForFree !== 'all',
    current.earlyAccess !== 'all',
    current.playtime !== 'all',
  ].filter(Boolean).length;
}

function activeFilterLabel(count: number): string {
  if (count === 0) return 'Nenhum filtro ativo';
  if (count === 1) return '1 filtro ativo';
  return `${count} filtros ativos`;
}

function renderFilterState(current: Filters): void {
  filterSummary.textContent = activeFilterLabel(activeFilterCount(current));

  const activeKeys: Record<string, boolean> = {
    app: current.appId !== null,
    language: current.language !== null,
    recommended: current.recommended !== 'all',
    steamPurchase: current.steamPurchase !== 'all',
    receivedForFree: current.receivedForFree !== 'all',
    earlyAccess: current.earlyAccess !== 'all',
    playtime: current.playtime !== 'all',
  };

  for (const row of form.querySelectorAll<HTMLElement>('[data-filter-row]')) {
    const key = row.dataset.filterRow;
    if (key && key in activeKeys) {
      row.classList.toggle('is-filtered', activeKeys[key]);
    }
  }

  const chips: FilterChip[] = [];

  if (current.appId !== null) {
    chips.push({
      label: 'Jogo',
      value: gameNameById.get(current.appId) ?? `#${current.appId}`,
      clear: () => patchFilters({ appId: null }),
    });
  }

  if (current.language !== null) {
    chips.push({
      label: 'Idioma',
      value: languageLabel(current.language),
      clear: () => patchFilters({ language: null }),
    });
  }

  if (current.recommended !== 'all') {
    chips.push({
      label: 'Recomendação',
      value: current.recommended === 'yes' ? 'Recomenda' : 'Não recomenda',
      clear: () => patchFilters({ recommended: 'all' }),
    });
  }

  if (current.steamPurchase !== 'all') {
    chips.push({
      label: 'Compra na Steam',
      value: current.steamPurchase === 'yes' ? 'Sim' : 'Não',
      clear: () => patchFilters({ steamPurchase: 'all' }),
    });
  }

  if (current.receivedForFree !== 'all') {
    chips.push({
      label: 'Recebido de graça',
      value: current.receivedForFree === 'yes' ? 'Sim' : 'Não',
      clear: () => patchFilters({ receivedForFree: 'all' }),
    });
  }

  if (current.earlyAccess !== 'all') {
    chips.push({
      label: 'Acesso antecipado',
      value: current.earlyAccess === 'yes' ? 'Sim' : 'Não',
      clear: () => patchFilters({ earlyAccess: 'all' }),
    });
  }

  if (current.playtime !== 'all') {
    chips.push({
      label: 'Tempo',
      value: PLAYTIME_LABELS[current.playtime],
      clear: () => patchFilters({ playtime: 'all' }),
    });
  }

  renderFilterChips(activeChips, chips, () => {
    resetFilters();
  });

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    const preset = btn.dataset.preset;
    if (!preset) continue;
    btn.setAttribute('aria-pressed', isPresetActive(current, preset) ? 'true' : 'false');
  }
}

function syncControls(current: Filters): void {
  appCombo.setCommitted(current.appId === null ? '' : String(current.appId));
  languageCombo.setCommitted(current.language ?? '');
  playtimeCombo.setCommitted(current.playtime);

  for (const btn of form.querySelectorAll<HTMLButtonElement>('[data-tri-filter]')) {
    const key = btn.dataset.triFilter as 'recommended' | 'steamPurchase' | 'receivedForFree' | 'earlyAccess' | undefined;
    const val = btn.dataset.triValue;
    if (!key || !val) continue;
    btn.setAttribute('aria-pressed', current[key] === val ? 'true' : 'false');
  }

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    const preset = btn.dataset.preset;
    if (!preset) continue;
    btn.setAttribute('aria-pressed', isPresetActive(current, preset) ? 'true' : 'false');
  }
}

function catalogSignature(options: ComboOption[]): string {
  return options.map((item) => `${item.value}\u0000${item.label}\u0000${item.count ?? ''}`).join('\u0001');
}

function renderCatalog(metrics: Metrics): void {
  for (const game of metrics.games) {
    appIdByName.set(game.app_name, game.app_id);
    gameNameById.set(game.app_id, game.app_name);
  }

  const gameOptions = metrics.games.map((game) => ({
    value: String(game.app_id),
    label: game.app_name,
    count: game.review_count,
  }));
  const gameKey = catalogSignature(gameOptions);
  if (gameKey !== gamesSignature) {
    gamesSignature = gameKey;
    appCombo.setOptions(gameOptions);
  }

  const languageOptions = metrics.languages.map((entry) => ({
    value: entry.language,
    label: languageLabel(entry.language),
    count: entry.review_count,
  }));
  const languageKey = catalogSignature(languageOptions);
  if (languageKey !== languagesSignature) {
    languagesSignature = languageKey;
    languageCombo.setOptions(languageOptions);
  }

  renderFilterState(filters.get());
}

function paintFigure(key: string, next: number): void {
  const figure = figures[key];
  if (!figure) return;
  const from = figure.value;
  figure.value = next;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (from === null || reduced || from === next) {
    figure.element.textContent = figure.format(next);
    return;
  }
  const start = performance.now();
  const tick = (now: number) => {
    if (figure.value !== next) return;
    const amount = Math.min(1, (now - start) / 360);
    const value = amount === 1 ? next : from + (next - from) * ease(amount);
    figure.element.textContent = figure.format(value);
    if (amount < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function renderMetrics(metrics: Metrics): void {
  if (activeFilterCount(filters.get()) === 0) {
    baselineReviews = metrics.total_reviews;
    baselineRate = metrics.recommendation_rate;
    baselineGames = metrics.game_count;
    baselineAuthors = metrics.author_count;
  }

  paintFigure('reviews', metrics.total_reviews);
  paintFigure('recommendation', metrics.recommendation_rate);
  paintFigure('games', metrics.game_count);
  paintFigure('authors', metrics.author_count);
  const presetNote = activePresetNote(filters.get());
  contextSubtitle.textContent = presetNote
    ? `${formatInteger(metrics.total_reviews)} avaliações · ${formatInteger(metrics.game_count)} jogos · ${presetNote}`
    : `${formatInteger(metrics.total_reviews)} avaliações · ${formatInteger(metrics.game_count)} jogos · ${BASELINE_PERIOD_SHORT}`;

  const filtered = activeFilterCount(filters.get()) > 0;

  metricReviewsSub.textContent = !filtered
    ? '100% da base\u00a0auditada'
    : `${formatPercent(baselineReviews > 0 ? metrics.total_reviews / baselineReviews : 0)} de\u00a0${formatInteger(baselineReviews)}`;

  if (!filtered) {
    metricRecommendationSub.textContent = 'média global da\u00a0base';
  } else {
    const diffPp = (metrics.recommendation_rate - baselineRate) * 100;
    metricRecommendationSub.textContent = `${ppFormat.format(diffPp)} p.p. vs. base\u00a0(${formatPercent(baselineRate)})`;
  }

  metricGamesSub.textContent = !filtered
    ? 'no catálogo\u00a0analisado'
    : `de ${formatInteger(baselineGames)} no\u00a0catálogo`;

  metricAuthorsSub.textContent = !filtered
    ? 'contas distintas na\u00a0base'
    : `${formatPercent(baselineAuthors > 0 ? metrics.author_count / baselineAuthors : 0)} de ${formatInteger(baselineAuthors)}\u00a0contas`;
}

function renderGameRanks(games: GameBar[]): void {
  rankGames.replaceChildren();
  if (games.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'meta';
    empty.textContent = 'Nenhum jogo no recorte.';
    rankGames.append(empty);
    return;
  }
  const max = Math.max(...games.map((game) => game.review_count), 1);
  const currentAppId = filters.get().appId;
  games.forEach((game, index) => {
    const appId = appIdByName.get(game.app_name) ?? null;
    const selected = appId !== null && currentAppId === appId;
    rankGames.append(
      rankRow(
        `game:${game.app_name}`,
        index,
        game.app_name,
        formatInteger(game.review_count),
        (game.review_count / max) * 100,
        {
          title: game.app_name,
          selected,
          ariaLabel: `${game.app_name}: ${formatInteger(game.review_count)} avaliações`,
          onSelect: () => {
            if (appId !== null) {
              patchFilters({ appId: selected ? null : appId });
            }
          },
        },
      ),
    );
  });
}

function renderLanguageRanks(languages: LanguageBar[]): void {
  rankLanguages.replaceChildren();
  if (languages.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'meta';
    empty.textContent = 'Nenhum idioma no recorte.';
    rankLanguages.append(empty);
    return;
  }
  const sorted = [...languages].sort(
    (a, b) => (b.recommendation_rate ?? -1) - (a.recommendation_rate ?? -1) || b.review_count - a.review_count,
  );
  const currentLanguage = filters.get().language;
  sorted.forEach((item, index) => {
    const selected = currentLanguage === item.language;
    const rate = item.recommendation_rate;
    const valueText = rate === null ? PLACEHOLDER : `${formatPercent(rate)} · ${formatInteger(item.review_count)}`;
    const name = languageLabel(item.language);
    rankLanguages.append(
      rankRow(
        `lang:${item.language}`,
        index,
        name,
        valueText,
        rate === null ? 0 : rate * 100,
        {
          title: `${name}: ${formatInteger(item.review_count)} avaliações`,
          selected,
          ariaLabel: `${name}: ${valueText}`,
          onSelect: () => {
            patchFilters({ language: selected ? null : item.language });
          },
        },
      ),
    );
  });
}

function renderRanks(series: Charts): void {
  renderGameRanks(series.games);
  renderLanguageRanks(series.languages);
}

function formatPageRange(offset: number, count: number, total: number): string {
  if (total === 0 || count === 0) return `0 de ${formatInteger(total)}`;
  const start = offset + 1;
  const end = offset + count;
  return `${formatInteger(start)}–${formatInteger(end)} de ${formatInteger(total)}`;
}

function renderReviews(reviews: ReviewsPage): void {
  reviewsBody.replaceChildren();
  if (reviews.items.length === 0) {
    reviewsBody.append(renderEmptyReviewRow(() => resetFilters()));
  } else {
    for (const item of reviews.items) reviewsBody.append(renderReviewRow(item));
  }

  pageRange.textContent = formatPageRange(reviews.offset, reviews.items.length, reviews.total);
  prevButton.disabled = reviews.offset <= 0;
  nextButton.disabled = reviews.offset + reviews.items.length >= reviews.total;
}

function syncSortHeaders(currentSort: Readonly<ReviewSort>): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-sort-by]')) {
    const th = btn.closest('th');
    const key = btn.dataset.sortBy as ReviewSortBy | undefined;
    if (key === currentSort.sortBy) {
      btn.classList.add('is-active');
      btn.dataset.sortDir = currentSort.sortDir;
      th?.setAttribute('aria-sort', currentSort.sortDir === 'asc' ? 'ascending' : 'descending');
    } else {
      btn.classList.remove('is-active');
      delete btn.dataset.sortDir;
      th?.setAttribute('aria-sort', 'none');
    }
  }
}

function setLoading(): void {
  window.clearTimeout(busyTimer);
  busyTimer = window.setTimeout(() => {
    main.setAttribute('aria-busy', 'true');
  }, 180);
  delete main.dataset.error;
  errorBanner.hidden = true;
}

async function load(): Promise<void> {
  const id = ++requestId;
  const currentFilters = filters.get();
  const currentPage = page.get();
  const currentSort = reviewSort.get();
  document.documentElement.dataset.fetching = 'true';
  setLoading();

  try {
    const [metrics, reviews, series] = await Promise.all([
      fetchMetrics(currentFilters),
      fetchReviews(currentFilters, currentPage, currentSort),
      fetchCharts(currentFilters),
    ]);
    if (id !== requestId) return;
    delete main.dataset.error;
    renderMetrics(metrics);
    renderCatalog(metrics);
    syncControls(filters.get());
    renderReviews(reviews);
    renderCharts(series, currentFilters.playtime);
    renderRanks(series);
  } catch (error) {
    if (id !== requestId) return;
    main.dataset.error = 'true';
    const detail = error instanceof Error ? `${error.message}. ` : '';
    loadErrorDetail.textContent = `${detail}Verifique se a API local está ativa em http://127.0.0.1:8000.`;
    errorBanner.hidden = false;
  } finally {
    if (id === requestId) {
      window.clearTimeout(busyTimer);
      main.setAttribute('aria-busy', 'false');
      delete document.documentElement.dataset.fetching;
    }
  }
}

function syncUrl(replace = false): void {
  if (syncingFromPopState) return;
  const search = writeFiltersToSearch(filters.get(), page.get(), reviewSort.get());
  const nextUrl = `${window.location.pathname}${search}${window.location.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    if (replace) {
      window.history.replaceState(null, '', nextUrl);
    } else {
      window.history.pushState(null, '', nextUrl);
    }
  }
}

function bindControls(): void {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  for (const btn of form.querySelectorAll<HTMLButtonElement>('[data-tri-filter]')) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.triFilter as
        | 'recommended'
        | 'steamPurchase'
        | 'receivedForFree'
        | 'earlyAccess'
        | undefined;
      if (!key) return;
      const value = readTri(btn.dataset.triValue ?? 'all');
      patchFilters({ [key]: value });
    });
  }

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-sort-by]')) {
    btn.addEventListener('click', () => {
      const key = btn.dataset.sortBy as ReviewSortBy | undefined;
      if (!key) return;
      const current = reviewSort.get();
      if (current.sortBy !== key) {
        reviewSort.set({ sortBy: key, sortDir: 'desc' });
      } else if (current.sortDir === 'desc') {
        reviewSort.set({ sortBy: key, sortDir: 'asc' });
      } else {
        reviewSort.set({ ...DEFAULT_SORT });
      }
    });
  }

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!preset || !(preset in PRESETS)) return;
      if (isPresetActive(filters.get(), preset)) {
        resetFilters();
      } else {
        syncingFromPopState = true;
        try {
          reviewSort.set(
            preset === 'dissatisfaction'
              ? { sortBy: 'votes_helpful', sortDir: 'desc' }
              : { ...DEFAULT_SORT },
          );
          page.set(0);
        } finally {
          syncingFromPopState = false;
        }
        filters.set({ ...PRESETS[preset as PresetKey] });
      }
    });
  }

  clearButton.addEventListener('click', () => {
    resetFilters();
  });

  prevButton.addEventListener('click', () => {
    const current = page.get();
    if (current > 0) page.set(current - 1);
  });

  nextButton.addEventListener('click', () => {
    page.set(page.get() + 1);
  });

  retryButton.addEventListener('click', () => {
    void load();
  });

  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)
    ) {
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      if (sidebarQuery.matches && !sidebarPanel.classList.contains('is-open')) {
        setMobileSidebar(true);
      }
      appInput.focus();
      return;
    }
    if (event.key === '[') {
      if (!prevButton.disabled) {
        event.preventDefault();
        prevButton.click();
      }
      return;
    }
    if (event.key === ']') {
      if (!nextButton.disabled) {
        event.preventDefault();
        nextButton.click();
      }
      return;
    }
  });
}

function init(): void {
  document.documentElement.dataset.fetching = 'true';
  initCharts((bucket) => {
    const current = filters.get().playtime;
    patchFilters({ playtime: current === bucket ? 'all' : bucket });
  });
  setupTheme(themeButton, repaintCharts);
  bindControls();

  const initial = readFiltersFromSearch(window.location.search);
  filters.set(initial.filters);
  page.set(initial.page);
  reviewSort.set(initial.sort);

  filters.listen(() => {
    const current = filters.get();
    syncControls(current);
    renderFilterState(current);
    syncSortHeaders(reviewSort.get());
    if (!syncingFromPopState && page.get() !== 0) {
      page.set(0);
      return;
    }
    syncUrl();
    void load();
  });

  page.listen(() => {
    syncUrl();
    void load();
  });

  reviewSort.listen(() => {
    syncSortHeaders(reviewSort.get());
    if (syncingFromPopState) return;
    if (page.get() !== 0) {
      page.set(0);
      return;
    }
    syncUrl();
    void load();
  });

  window.addEventListener('popstate', () => {
    syncingFromPopState = true;
    try {
      const next = readFiltersFromSearch(window.location.search);
      page.set(next.page);
      filters.set(next.filters);
      reviewSort.set(next.sort);
      syncSortHeaders(next.sort);
    } finally {
      syncingFromPopState = false;
    }
  });

  syncControls(filters.get());
  renderFilterState(filters.get());
  syncSortHeaders(reviewSort.get());
  syncUrl(true);
  void load();
}

init();
