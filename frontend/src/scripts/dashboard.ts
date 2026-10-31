import {
  fetchCharts,
  fetchMetrics,
  fetchReviews,
  type Charts,
  type GameBar,
  type LanguageBar,
  type Metrics,
  type ReviewItem,
  type ReviewsPage,
} from '../lib/api';
import { formatDate, formatHours, formatInteger, formatPercent, languageLabel } from '../lib/format';
import {
  PLAYTIME_LABELS,
  filters,
  page,
  readFiltersFromSearch,
  resetFilters,
  writeFiltersToSearch,
  type Filters,
  type PlaytimeBucket,
  type Tri,
} from '../stores/filters';
import { initCharts, renderCharts, repaintCharts } from './charts';

const PLACEHOLDER = '—';
const THEME_KEY = 'steam-reviews-theme';
const THEME_REVEAL_MS = 400;

type ComboOption = { value: string; label: string; count?: number };

function requireElement<T extends Element>(id: string, ctor: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof ctor)) {
    throw new Error(`Elemento não encontrado: ${id}`);
  }
  return element;
}

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
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

class SearchCombo {
  private options: ComboOption[] = [];
  private committed: string;
  private query = '';
  private active = 0;
  private open = false;
  private blurTimer = 0;
  private readonly root: HTMLElement;
  private readonly toggle: HTMLButtonElement;
  private readonly icon: SVGSVGElement;
  private readonly onReflow = () => {
    if (this.open) this.placeMenu();
  };

  constructor(
    private readonly input: HTMLInputElement,
    private readonly menu: HTMLUListElement,
    private readonly onCommit: (value: string) => void,
    private readonly emptyOption: ComboOption = { value: '', label: 'Todos' },
  ) {
    const root = input.parentElement;
    if (!(root instanceof HTMLElement)) {
      throw new Error(`Combo sem contêiner: ${input.id}`);
    }
    this.root = root;
    const toggle = root.querySelector(':scope > .combo-toggle');
    const icon = toggle?.querySelector(':scope > .combo-toggle-icon');
    if (!(toggle instanceof HTMLButtonElement) || !(icon instanceof SVGSVGElement)) {
      throw new Error(`Combo sem botão: ${input.id}`);
    }
    this.toggle = toggle;
    this.icon = icon;
    this.toggle.setAttribute('aria-controls', menu.id);

    this.committed = emptyOption.value;
    input.placeholder = emptyOption.label;
    input.addEventListener('focus', () => {
      this.query = '';
      this.input.select();
      this.openMenu(true);
    });
    input.addEventListener('input', () => {
      this.query = this.input.value;
      this.openMenu(true);
    });
    input.addEventListener('keydown', (event) => {
      this.onKey(event);
    });
    input.addEventListener('blur', () => {
      this.blurTimer = window.setTimeout(() => this.finishEditing(), 150);
    });
    this.toggle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      window.clearTimeout(this.blurTimer);
      this.onToggle();
    });
    this.toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    menu.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      window.clearTimeout(this.blurTimer);
    });
    menu.addEventListener('click', (event) => {
      const option = event.target instanceof Element ? event.target.closest('[data-value]') : null;
      if (!(option instanceof HTMLElement)) return;
      this.commit(option.dataset.value ?? this.emptyOption.value);
      this.input.focus();
    });
    window.addEventListener('resize', this.onReflow);
    document.addEventListener('scroll', this.onReflow, true);
    const box = new ResizeObserver(() => {
      if (this.open) this.placeMenu();
    });
    box.observe(this.input);
  }

  setOptions(options: ComboOption[]): void {
    this.options = options;
    if (this.open) this.paint(false);
    else if (document.activeElement !== this.input) this.showCommitted();
  }

  setCommitted(value: string): void {
    this.committed = value;
    if (document.activeElement === this.input && this.open) return;
    this.showCommitted();
  }

  private filtered(): ComboOption[] {
    const query = fold(this.query.trim());
    const matches =
      query === ''
        ? this.options
        : this.options.filter((item) => fold(item.label).includes(query) || fold(item.value).includes(query));
    const emptyMatches = query === '' || fold(this.emptyOption.label).includes(query);
    return emptyMatches ? [this.emptyOption, ...matches] : matches;
  }

  private showCommitted(): void {
    if (this.committed === this.emptyOption.value) {
      this.input.value = '';
      return;
    }
    const match = this.options.find((item) => item.value === this.committed);
    this.input.value = match?.label ?? '';
  }

  private placeMenu(): void {
    const rect = this.input.getBoundingClientRect();
    const height = Math.min(this.menu.scrollHeight, 240);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const openUp = spaceBelow < height && rect.top > spaceBelow;
    this.setDirection(openUp);
    this.menu.style.position = 'fixed';
    this.menu.style.left = `${rect.left}px`;
    this.menu.style.width = `${rect.width}px`;
    this.menu.style.right = 'auto';
    if (openUp) {
      this.menu.style.top = 'auto';
      this.menu.style.bottom = `${window.innerHeight - rect.top + 4}px`;
    } else {
      this.menu.style.bottom = 'auto';
      this.menu.style.top = `${rect.bottom + 4}px`;
    }
  }

  private setDirection(openUp: boolean): void {
    const wasUp = this.root.classList.contains('is-up');
    if (wasUp === openUp) return;
    if (this.open) this.icon.style.transition = 'none';
    this.root.classList.toggle('is-up', openUp);
    if (this.open) {
      void this.icon.getBoundingClientRect();
      this.icon.style.transition = '';
    }
  }

  private openMenu(reset: boolean): void {
    const opening = !this.open;
    this.paint(reset);
    this.placeMenu();
    if (opening) void this.menu.offsetHeight;
    this.open = true;
    this.menu.classList.add('is-open');
    this.root.classList.add('is-open');
    this.input.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-expanded', 'true');
    this.toggle.setAttribute('aria-label', 'Ocultar opções');
  }

  private close(): void {
    this.open = false;
    this.menu.classList.remove('is-open');
    this.root.classList.remove('is-open');
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.toggle.setAttribute('aria-label', 'Mostrar opções');
  }

  private onToggle(): void {
    if (this.open) {
      this.showCommitted();
      this.close();
      this.input.blur();
      return;
    }
    this.query = '';
    const alreadyFocused = document.activeElement === this.input;
    this.input.focus();
    if (alreadyFocused) this.openMenu(true);
  }

  private paint(reset: boolean): void {
    const items = this.filtered();
    if (reset) {
      const selected = items.findIndex((item) => item.value === this.committed);
      this.active = selected >= 0 ? selected : 0;
    }
    if (this.active >= items.length) this.active = Math.max(0, items.length - 1);
    this.menu.replaceChildren();

    if (items.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'combo-empty';
      empty.textContent = 'Nenhum resultado';
      this.menu.append(empty);
      this.input.removeAttribute('aria-activedescendant');
      return;
    }

    items.forEach((item, index) => {
      const option = document.createElement('li');
      option.className = index === this.active ? 'combo-option is-active' : 'combo-option';
      option.id = `${this.input.id}-opt-${index}`;
      option.dataset.value = item.value;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', item.value === this.committed ? 'true' : 'false');
      option.title = item.label;

      const labelSpan = document.createElement('span');
      labelSpan.className = 'combo-option-label';
      labelSpan.textContent = item.label;
      option.append(labelSpan);
      if (typeof item.count === 'number') {
        const countSpan = document.createElement('span');
        countSpan.className = 'combo-option-count';
        countSpan.textContent = formatInteger(item.count);
        option.append(countSpan);
      }

      this.menu.append(option);
    });

    const current = this.menu.children.item(this.active);
    if (current instanceof HTMLElement) {
      this.input.setAttribute('aria-activedescendant', current.id);
      const menuRect = this.menu.getBoundingClientRect();
      const optionRect = current.getBoundingClientRect();
      if (optionRect.bottom > menuRect.bottom) {
        this.menu.scrollTop += optionRect.bottom - menuRect.bottom;
      } else if (optionRect.top < menuRect.top) {
        this.menu.scrollTop -= menuRect.top - optionRect.top;
      }
    }
  }

  private commit(value: string): void {
    const changed = value !== this.committed;
    this.committed = value;
    this.showCommitted();
    this.close();
    if (changed) this.onCommit(value);
  }

  private finishEditing(): void {
    if (!this.open && document.activeElement !== this.input) {
      this.showCommitted();
      return;
    }
    const typed = this.input.value.trim();
    if (typed === '' || fold(typed) === fold(this.emptyOption.label)) {
      this.commit(this.emptyOption.value);
      return;
    }
    const match = this.options.find((item) => fold(item.label) === fold(typed));
    if (match) this.commit(match.value);
    else {
      this.showCommitted();
      this.close();
    }
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!this.open) this.openMenu(true);
      const count = this.filtered().length;
      if (count === 0) return;
      this.active += event.key === 'ArrowDown' ? 1 : -1;
      if (this.active < 0) this.active = count - 1;
      if (this.active >= count) this.active = 0;
      this.paint(false);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const items = this.filtered();
      const picked = items[this.active];
      if (this.open && picked) this.commit(picked.value);
      else this.finishEditing();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.showCommitted();
      this.close();
    }
  }
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

const playtimeCombo = choiceCombo(
  'filter-playtime',
  { value: 'all', label: 'Todos' },
  [
    { value: 'lt1', label: 'Menos de 1 h' },
    { value: 'h1_2', label: '1 a 2 h' },
    { value: 'h2_5', label: '2 a 5 h' },
    { value: 'h5_10', label: '5 a 10 h' },
    { value: 'h10_25', label: '10 a 25 h' },
    { value: 'h25_50', label: '25 a 50 h' },
    { value: 'h50_100', label: '50 a 100 h' },
    { value: 'h100_500', label: '100 a 500 h' },
    { value: 'gte500', label: '500 h ou mais' },
  ],
  (value) => {
    patchFilters({ playtime: readPlaytime(value) });
  },
);

let requestId = 0;
let gamesSignature = '';
let languagesSignature = '';
const appIdByName = new Map<string, number>();
const gameNameById = new Map<number, string>();
let syncingFromPopState = false;

const BASELINE_REVIEWS = 1_000_000;
const BASELINE_RATE = 0.8297;
const BASELINE_GAMES = 59;
const BASELINE_AUTHORS = 912_553;

let baselineReviews = BASELINE_REVIEWS;
let baselineRate = BASELINE_RATE;
let baselineGames = BASELINE_GAMES;
let baselineAuthors = BASELINE_AUTHORS;

const ppFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

type PresetKey = 'refund' | 'early' | 'dissatisfaction';

const PRESETS: Record<PresetKey, Filters> = {
  refund: {
    appId: null,
    language: null,
    recommended: 'all',
    steamPurchase: 'all',
    receivedForFree: 'all',
    earlyAccess: 'all',
    playtime: 'lt1',
  },
  early: {
    appId: null,
    language: null,
    recommended: 'all',
    steamPurchase: 'all',
    receivedForFree: 'all',
    earlyAccess: 'yes',
    playtime: 'all',
  },
  dissatisfaction: {
    appId: null,
    language: null,
    recommended: 'no',
    steamPurchase: 'all',
    receivedForFree: 'all',
    earlyAccess: 'all',
    playtime: 'all',
  },
};

const PRESET_NOTES: Record<PresetKey, string> = {
  refund: 'tese: aprovação cai para 49,6% na 1ª hora\u00a0de\u00a0jogo',
  early: 'tese: 69,8% em acesso antecipado vs. 83,8%\u00a0fora\u00a0dele',
  dissatisfaction: 'tese: avaliações negativas recebem 2,8× mais\u00a0votos\u00a0úteis',
};

function isPresetActive(current: Filters, preset: string): boolean {
  if (preset !== 'refund' && preset !== 'early' && preset !== 'dissatisfaction') return false;
  const target = PRESETS[preset];
  return (
    current.appId === target.appId &&
    current.language === target.language &&
    current.recommended === target.recommended &&
    current.steamPurchase === target.steamPurchase &&
    current.receivedForFree === target.receivedForFree &&
    current.earlyAccess === target.earlyAccess &&
    current.playtime === target.playtime
  );
}

function activePresetNote(current: Filters): string | null {
  const keys: PresetKey[] = ['refund', 'early', 'dissatisfaction'];
  for (const key of keys) {
    if (isPresetActive(current, key)) return PRESET_NOTES[key];
  }
  return null;
}

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

type FilterChip = {
  label: string;
  value: string;
  clear: () => void;
};

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

  activeChips.replaceChildren();

  if (chips.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'meta';
    empty.textContent = 'Base completa · nenhum filtro ativo';
    activeChips.append(empty);
    return;
  }

  for (const chip of chips) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-chip';
    btn.setAttribute('aria-label', `Remover filtro ${chip.label}: ${chip.value}`);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'filter-chip-label';
    labelSpan.textContent = `${chip.label}:`;

    const valueSpan = document.createElement('span');
    valueSpan.className = 'filter-chip-value';
    valueSpan.textContent = chip.value;

    const removeSpan = document.createElement('span');
    removeSpan.className = 'filter-chip-remove';
    removeSpan.setAttribute('aria-hidden', 'true');
    removeSpan.textContent = '×';

    btn.append(labelSpan, valueSpan, removeSpan);
    btn.addEventListener('click', () => {
      chip.clear();
    });

    activeChips.append(btn);
  }

  if (chips.length >= 2) {
    const resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.className = 'filter-chip is-reset';
    resetBtn.textContent = 'Limpar todos';
    resetBtn.addEventListener('click', () => {
      resetFilters();
    });
    activeChips.append(resetBtn);
  }

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
    : `${formatInteger(metrics.total_reviews)} avaliações · ${formatInteger(metrics.game_count)} jogos · mar/2013 a\u00a0jan/2021`;

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

const previousRankScales = new Map<string, number>();

function rankRow(
  key: string,
  index: number,
  name: string,
  value: string,
  widthPercent: number,
  options: { title: string; selected: boolean; ariaLabel: string; onSelect: () => void },
): HTMLLIElement {
  const row = document.createElement('li');
  row.className = options.selected ? 'rank-row is-selected' : 'rank-row';
  row.title = options.title;
  row.tabIndex = 0;
  row.setAttribute('role', 'button');
  row.setAttribute('aria-pressed', options.selected ? 'true' : 'false');
  row.setAttribute('aria-label', options.ariaLabel);

  row.addEventListener('click', () => {
    options.onSelect();
  });
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      options.onSelect();
    }
  });

  const line = document.createElement('div');
  line.className = 'rank-line';

  const label = document.createElement('span');
  label.className = 'min-w-0 flex-1 truncate';
  label.textContent = name;

  const number = document.createElement('span');
  number.className = 'rank-value';
  number.textContent = value;

  const track = document.createElement('div');
  track.className = 'rank-track';
  track.setAttribute('aria-hidden', 'true');

  const fill = document.createElement('div');
  fill.className = 'rank-fill';

  const targetScale = Math.max(0, Math.min(1, widthPercent / 100));
  const fromScale = previousRankScales.get(key) ?? 0;
  previousRankScales.set(key, targetScale);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || Math.abs(fromScale - targetScale) < 1e-4) {
    fill.style.transform = `scaleX(${targetScale})`;
  } else {
    fill.style.transform = `scaleX(${fromScale})`;
    fill.style.transitionDelay = `${Math.min(index * 20, 140)}ms`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.transform = `scaleX(${targetScale})`;
      });
    });
  }

  line.append(label, number);
  track.append(fill);
  row.append(line, track);
  return row;
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

function textCell(text: string, title?: string): HTMLTableCellElement {
  const element = document.createElement('td');
  element.textContent = text;
  if (title !== undefined) element.title = title;
  return element;
}

function recommendationCell(recommended: boolean): HTMLTableCellElement {
  const element = document.createElement('td');
  if (recommended) {
    const mark = document.createElement('span');
    mark.className = 'sim';
    const rule = document.createElement('span');
    rule.className = 'sim-rule';
    rule.setAttribute('aria-hidden', 'true');
    mark.append(rule, document.createTextNode('Sim'));
    element.append(mark);
  } else {
    const mark = document.createElement('span');
    mark.className = 'nao';
    mark.textContent = 'Não';
    element.append(mark);
  }
  return element;
}

function renderReviewRow(item: ReviewItem): HTMLTableRowElement {
  const row = document.createElement('tr');
  row.className = 'review-row';
  row.tabIndex = 0;
  row.setAttribute('aria-expanded', 'false');

  const toggleRow = (): void => {
    const expanded = row.classList.toggle('is-expanded');
    row.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  };
  row.addEventListener('click', toggleRow);
  row.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleRow();
    }
  });

  const hours = item.playtime_at_review_hours;
  const hoursText = hours === null || !Number.isFinite(hours) ? PLACEHOLDER : formatHours(hours);
  const language = languageLabel(item.language);

  const excerptTd = document.createElement('td');
  const excerptCell = document.createElement('div');
  excerptCell.className = 'excerpt-cell';

  const excerptLine = document.createElement('div');
  excerptLine.className = 'excerpt-line';

  const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  chevron.setAttribute('viewBox', '0 0 24 24');
  chevron.setAttribute('fill', 'none');
  chevron.setAttribute('stroke', 'currentColor');
  chevron.setAttribute('stroke-width', '2');
  chevron.setAttribute('stroke-linecap', 'round');
  chevron.setAttribute('stroke-linejoin', 'round');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.classList.add('excerpt-chevron');
  const chevronPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  chevronPath.setAttribute('d', 'm9 18 6-6-6-6');
  chevron.append(chevronPath);

  const excerptText = document.createElement('div');
  excerptText.className = 'excerpt-text';
  excerptText.textContent = item.excerpt || 'Sem texto na avaliação.';

  excerptLine.append(chevron, excerptText);
  excerptCell.append(excerptLine);

  const badges = document.createElement('div');
  badges.className = 'review-badges';

  const dateBadge = document.createElement('span');
  dateBadge.className = 'review-badge';
  dateBadge.textContent = formatDate(item.created_at);
  badges.append(dateBadge);

  if (item.early_access) {
    const badge = document.createElement('span');
    badge.className = 'review-badge is-accent';
    badge.textContent = 'Acesso antecipado';
    badges.append(badge);
  }

  if (item.received_for_free) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = 'Recebido de graça';
    badges.append(badge);
  }

  if (!item.steam_purchase) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = 'Chave externa';
    badges.append(badge);
  }

  if (item.votes_funny > 0) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = `${formatInteger(item.votes_funny)} engraçados`;
    badges.append(badge);
  }

  if (item.comment_count > 0) {
    const badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = `${formatInteger(item.comment_count)} coment.`;
    badges.append(badge);
  }

  excerptCell.append(badges);
  excerptTd.append(excerptCell);

  row.append(
    textCell(item.app_name, item.app_name),
    textCell(language, language),
    recommendationCell(item.recommended),
    textCell(hoursText),
    textCell(formatInteger(item.votes_helpful)),
    excerptTd,
  );
  return row;
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
    const row = document.createElement('tr');
    const empty = document.createElement('td');
    empty.colSpan = 6;
    empty.className = 'empty-cell';
    empty.textContent = 'Nenhuma avaliação com esses filtros.';
    row.append(empty);
    reviewsBody.append(row);
  } else {
    for (const item of reviews.items) reviewsBody.append(renderReviewRow(item));
  }

  pageRange.textContent = formatPageRange(reviews.offset, reviews.items.length, reviews.total);
  prevButton.disabled = reviews.offset <= 0;
  nextButton.disabled = reviews.offset + reviews.items.length >= reviews.total;
}

function currentTheme(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function applyTheme(theme: 'dark' | 'light'): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(THEME_KEY, theme);
  themeButton.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  repaintCharts();
}

let themeReveal: Animation | null = null;

function themeOrigin(): { x: number; y: number } {
  const icons = themeButton.querySelectorAll('.when-light, .when-dark');
  for (const icon of icons) {
    if (!(icon instanceof HTMLElement)) continue;
    const box = icon.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
  }
  const box = themeButton.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function circleClip(
  x: number,
  y: number,
  radius: number,
  width: number,
  height: number,
): [string, string] {
  const point = `${(x / width) * 100}% ${(y / height) * 100}%`;
  // circle() percentages resolve against hypot(w, h) / sqrt(2), not px.
  // Px clip-paths land off-center on the first transition at fractional display scale.
  const end = (radius / (Math.hypot(width, height) / Math.SQRT2)) * 100;
  return [`circle(0% at ${point})`, `circle(${end}% at ${point})`];
}

function revealTheme(next: 'dark' | 'light'): void {
  const root = document.documentElement;
  if (root.dataset.themeReveal === 'active') return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof document.startViewTransition !== 'function') {
    applyTheme(next);
    return;
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const origin = themeOrigin();
  const radius = Math.hypot(
    Math.max(origin.x, width - origin.x),
    Math.max(origin.y, height - origin.y),
  );
  const clipPath = circleClip(origin.x, origin.y, radius, width, height);

  root.dataset.themeReveal = 'active';
  root.style.setProperty('--theme-reveal-duration', `${THEME_REVEAL_MS}ms`);
  root.style.setProperty('--theme-reveal-clip', clipPath[0]);

  const cleanup = (): void => {
    delete root.dataset.themeReveal;
    root.style.removeProperty('--theme-reveal-duration');
    root.style.removeProperty('--theme-reveal-clip');
    themeReveal?.cancel();
    themeReveal = null;
  };

  let transition: ViewTransition;
  try {
    transition = document.startViewTransition(() => {
      applyTheme(next);
    });
  } catch {
    cleanup();
    if (currentTheme() !== next) applyTheme(next);
    return;
  }

  transition.finished.finally(cleanup).catch(() => {});
  transition.ready
    .then(() => {
      themeReveal = root.animate(
        { clipPath },
        {
          duration: THEME_REVEAL_MS,
          easing: 'ease-in-out',
          fill: 'forwards',
          pseudoElement: '::view-transition-new(root)',
        },
      );
    })
    .catch(() => {});
}

function setLoading(): void {
  main.setAttribute('aria-busy', 'true');
  delete main.dataset.error;
  errorBanner.hidden = true;
}

async function load(): Promise<void> {
  const id = ++requestId;
  const currentFilters = filters.get();
  const currentPage = page.get();
  setLoading();

  try {
    const [metrics, reviews, series] = await Promise.all([
      fetchMetrics(currentFilters),
      fetchReviews(currentFilters, currentPage),
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
    if (id === requestId) main.setAttribute('aria-busy', 'false');
  }
}

function syncUrl(replace = false): void {
  if (syncingFromPopState) return;
  const search = writeFiltersToSearch(filters.get(), page.get());
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

  for (const btn of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (!preset || !(preset in PRESETS)) return;
      if (isPresetActive(filters.get(), preset)) {
        resetFilters();
      } else {
        filters.set({ ...PRESETS[preset as PresetKey] });
      }
    });
  }

  clearButton.addEventListener('click', () => {
    resetFilters();
  });

  themeButton.addEventListener('click', () => {
    revealTheme(currentTheme() === 'dark' ? 'light' : 'dark');
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
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (
      event.target instanceof HTMLElement &&
      (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
    if (sidebarQuery.matches && !sidebarPanel.classList.contains('is-open')) {
      setMobileSidebar(true);
    }
    appInput.focus();
  });
}

function init(): void {
  initCharts((bucket) => {
    const current = filters.get().playtime;
    patchFilters({ playtime: current === bucket ? 'all' : bucket });
  });
  themeButton.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  bindControls();

  const initial = readFiltersFromSearch(window.location.search);
  filters.set(initial.filters);
  page.set(initial.page);

  filters.listen(() => {
    const current = filters.get();
    syncControls(current);
    renderFilterState(current);
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

  window.addEventListener('popstate', () => {
    syncingFromPopState = true;
    try {
      const next = readFiltersFromSearch(window.location.search);
      page.set(next.page);
      filters.set(next.filters);
    } finally {
      syncingFromPopState = false;
    }
  });

  syncControls(filters.get());
  renderFilterState(filters.get());
  syncUrl(true);
  void load();
}

init();
