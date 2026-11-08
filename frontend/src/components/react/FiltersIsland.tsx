import {
  ChevronDown,
  Eraser,
  Gamepad2,
  Gift,
  Languages,
  Rocket,
  ShoppingBag,
  ThumbsUp,
  Timer,
  type IconNode,
} from 'lucide';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { fetchFacets } from '../../lib/api';
import { PLAYTIME_OPTIONS } from '../../lib/constants';
import { formatCount, languageLabel } from '../../lib/format';
import { useFilters, useLatestMetrics } from '../../lib/useNanostore';
import { useHydrated } from '../../lib/useHydrated';
import { mobileSidebarOpen } from '../../stores/ui';
import { SearchCombo, type ComboOption } from '../../scripts/combo';
import {
  activeFilterCount,
  filters,
  resetFilters,
  type Filters,
  type PlaytimeBucket,
  type Tri,
} from '../../stores/filters';
import { RailIcon } from './RailIcon';
import { DateRangeFilter } from './DateRangeFilter';
import { QueryRoot } from './QueryRoot';

const MORE_FILTERS_KEY = 'steam-reviews-more-filters';

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
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

function readTri(value: string): Tri {
  if (value === 'yes' || value === 'no') return value;
  return 'all';
}

function catalogSignature(options: ComboOption[]): string {
  return options.map((item) => `${item.value}\u0000${item.label}\u0000${item.count ?? ''}`).join('\u0001');
}

function activeFilterLabel(count: number): string {
  if (count === 0) return 'Nenhum filtro ativo';
  if (count === 1) return '1 filtro ativo';
  return `${count} filtros ativos`;
}

function countMoreFilters(current: Readonly<Filters>): number {
  return [current.recommended, current.steamPurchase, current.receivedForFree, current.earlyAccess].filter(
    (value) => value !== 'all',
  ).length;
}

function readMorePreference(): boolean | null {
  try {
    const saved = window.localStorage.getItem(MORE_FILTERS_KEY);
    if (saved === 'open') return true;
    if (saved === 'closed') return false;
  } catch {
    /* armazenamento bloqueado */
  }
  return null;
}

function writeMorePreference(open: boolean): void {
  try {
    window.localStorage.setItem(MORE_FILTERS_KEY, open ? 'open' : 'closed');
  } catch {
    /* armazenamento bloqueado */
  }
}

type TriFilterKey = 'recommended' | 'steamPurchase' | 'receivedForFree' | 'earlyAccess';

function ComboToggle() {
  return (
    <button
      type="button"
      className="combo-toggle"
      tabIndex={-1}
      aria-label="Alternar lista de opções"
    >
      <svg
        className="combo-toggle-icon"
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M4 6l4 4 4-4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function FilterCombo({
  rowKey,
  inputId,
  label,
  icon,
  shortcut,
  filtered,
  inputRef,
  menuRef,
}: {
  rowKey: 'app' | 'language' | 'playtime';
  inputId: string;
  label: string;
  icon: IconNode;
  shortcut?: string;
  filtered: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  menuRef: RefObject<HTMLUListElement | null>;
}) {
  const listId = `${inputId}-list`;
  return (
    <div
      className={`sidebar-row is-field${filtered ? ' is-filtered' : ''}`}
      data-filter-row={rowKey}
      title={label}
    >
      <RailIcon icon={icon} />
      <span className="sidebar-reveal">
        <span className="sidebar-reveal-inner field">
          {shortcut ? (
            <div className="field-label-row">
              <label htmlFor={inputId} className="field-label">
                {label}
              </label>
              <kbd className="shortcut-hint" aria-hidden="true" title={`Atalho de teclado: ${shortcut}`}>
                {shortcut}
              </kbd>
            </div>
          ) : (
            <label htmlFor={inputId} className="field-label">
              {label}
            </label>
          )}
          <div className="combo">
            <span className="combo-mirror" aria-hidden="true" />
            <input
              ref={inputRef}
              id={inputId}
              className="field-control"
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-expanded="false"
              aria-controls={listId}
              aria-keyshortcuts={shortcut}
              autoComplete="off"
              spellCheck={false}
              placeholder="Todos"
            />
            <ul ref={menuRef} id={listId} className="combo-menu" role="listbox" />
            <ComboToggle />
          </div>
        </span>
      </span>
    </div>
  );
}

function TriFilterRow({
  filterKey,
  label,
  icon,
  value,
  filtered,
  onSelect,
}: {
  filterKey: TriFilterKey;
  label: string;
  icon: IconNode;
  value: Tri;
  filtered: boolean;
  onSelect: (tri: Tri) => void;
}) {
  const options: Tri[] = ['all', 'yes', 'no'];
  const labels = ['Todas', 'Sim', 'Não'];
  return (
    <div
      className={`sidebar-row is-field${filtered ? ' is-filtered' : ''}`}
      data-filter-row={filterKey}
      title={label}
    >
      <RailIcon icon={icon} />
      <span className="sidebar-reveal">
        <span className="sidebar-reveal-inner field">
          <span className="field-label">{label}</span>
          <div className="seg-control" role="group" aria-label={label}>
            {options.map((tri, index) => (
              <button
                key={tri}
                type="button"
                className="seg-btn"
                data-tri-filter={filterKey}
                data-tri-value={tri}
                aria-pressed={value === tri ? 'true' : 'false'}
                onClick={() => onSelect(tri)}
              >
                {labels[index]}
              </button>
            ))}
          </div>
        </span>
      </span>
    </div>
  );
}

/**
 * Disclosure "Mais filtros". Abre sozinho quando algum dos seus filtros está
 * ativo (URL, predefinição); a escolha manual do usuário é lembrada.
 */
function MoreFilters({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const hasActive = activeCount > 0;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (readMorePreference() === true) setOpen(true);
  }, []);

  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);

  const toggle = (): void => {
    const next = !open;
    setOpen(next);
    writeMorePreference(next);
  };

  return (
    <div className="disclosure">
      <button
        id="more-filters-toggle"
        type="button"
        className="sidebar-row disclosure-toggle"
        aria-expanded={open}
        aria-controls="more-filters"
        onClick={toggle}
      >
        <RailIcon icon={ChevronDown} className={open ? 'sidebar-icon disclosure-chevron is-open' : 'sidebar-icon disclosure-chevron'} />
        <span className="sidebar-reveal">
          <span className="sidebar-reveal-inner disclosure-label">
            Mais filtros
            {hasActive ? <span className="disclosure-count">{` (${activeCount})`}</span> : null}
          </span>
        </span>
      </button>
      <div
        id="more-filters"
        role="region"
        aria-labelledby="more-filters-toggle"
        className={open ? 'disclosure-region is-open' : 'disclosure-region'}
        inert={!open}
      >
        <div className="disclosure-inner">{children}</div>
      </div>
    </div>
  );
}

type CombosRef = {
  app: SearchCombo;
  language: SearchCombo;
  playtime: SearchCombo;
};

function FiltersContent() {
  const mounted = useHydrated();

  const currentFilters = useFilters();
  const metrics = useLatestMetrics();
  // Contagens por faceta: cada combo ignora o próprio filtro (ver backend `facets()`).
  // keepPreviousData evita piscar zeros enquanto o novo recorte carrega.
  const { data: facets } = useQuery({
    queryKey: ['facets', currentFilters],
    queryFn: () => fetchFacets(currentFilters),
    // Só depois de hidratar: na hidratação useFilters() devolve o recorte do servidor (padrão) e a
    // query buscaria esse recorte antes do render seguinte, que já traz os filtros da URL.
    enabled: mounted,
    placeholderData: keepPreviousData,
  });

  const appInputRef = useRef<HTMLInputElement>(null);
  const appMenuRef = useRef<HTMLUListElement>(null);
  const languageInputRef = useRef<HTMLInputElement>(null);
  const languageMenuRef = useRef<HTMLUListElement>(null);
  const playtimeInputRef = useRef<HTMLInputElement>(null);
  const playtimeMenuRef = useRef<HTMLUListElement>(null);
  const combosRef = useRef<CombosRef | null>(null);
  const gamesSignatureRef = useRef('');
  const languagesSignatureRef = useRef('');

  useLayoutEffect(() => {
    const appInput = appInputRef.current;
    const appMenu = appMenuRef.current;
    const languageInput = languageInputRef.current;
    const languageMenu = languageMenuRef.current;
    const playtimeInput = playtimeInputRef.current;
    const playtimeMenu = playtimeMenuRef.current;
    if (!appInput || !appMenu || !languageInput || !languageMenu || !playtimeInput || !playtimeMenu) {
      return;
    }
    if (appInput.dataset.comboBound === 'true') return;
    appInput.dataset.comboBound = 'true';

    const appCombo = new SearchCombo(appInput, appMenu, (value) => {
      const appId = value === '' ? null : Number(value);
      patchFilters({ appId: appId !== null && Number.isFinite(appId) ? appId : null });
    });

    const languageCombo = new SearchCombo(languageInput, languageMenu, (value) => {
      patchFilters({ language: value === '' ? null : value });
    });

    const playtimeCombo = new SearchCombo(
      playtimeInput,
      playtimeMenu,
      (value) => {
        patchFilters({ playtime: readPlaytime(value) });
      },
      { value: 'all', label: 'Todos' },
    );
    playtimeCombo.setOptions(
      PLAYTIME_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    );

    combosRef.current = { app: appCombo, language: languageCombo, playtime: playtimeCombo };

    const initial = filters.get();
    appCombo.setCommitted(initial.appId === null ? '' : String(initial.appId));
    languageCombo.setCommitted(initial.language ?? '');
    playtimeCombo.setCommitted(initial.playtime);
  });

  useEffect(() => {
    const combos = combosRef.current;
    if (!combos) return;
    combos.app.setCommitted(currentFilters.appId === null ? '' : String(currentFilters.appId));
    combos.language.setCommitted(currentFilters.language ?? '');
    combos.playtime.setCommitted(currentFilters.playtime);
  }, [currentFilters]);

  useEffect(() => {
    const combos = combosRef.current;
    if (!combos || !metrics) return;

    // Catálogo completo vem de `metrics`; a contagem vem do recorte de facetas.
    // Valor ausente nas facetas significa zero. Sem facetas ainda, usa a contagem global.
    const gameCounts = facets
      ? new Map<number, number>(facets.games.map((game) => [game.app_id, game.review_count]))
      : null;
    const gameOptions = metrics.games.map((game) => ({
      value: String(game.app_id),
      label: game.app_name,
      count: gameCounts ? (gameCounts.get(game.app_id) ?? 0) : game.review_count,
    }));
    const gameKey = catalogSignature(gameOptions);
    if (gameKey !== gamesSignatureRef.current) {
      gamesSignatureRef.current = gameKey;
      combos.app.setOptions(gameOptions);
    }

    const languageCounts = facets
      ? new Map<string, number>(facets.languages.map((entry) => [entry.language, entry.review_count]))
      : null;
    const languageOptions = metrics.languages.map((entry) => ({
      value: entry.language,
      label: languageLabel(entry.language),
      count: languageCounts ? (languageCounts.get(entry.language) ?? 0) : entry.review_count,
    }));
    const languageKey = catalogSignature(languageOptions);
    if (languageKey !== languagesSignatureRef.current) {
      languagesSignatureRef.current = languageKey;
      combos.language.setOptions(languageOptions);
    }
  }, [metrics, facets]);

  const count = activeFilterCount(currentFilters);
  const moreCount = countMoreFilters(currentFilters);

  return (
    <div className="filters-panel">
      <form id="filters-form" className="mt-4 flex flex-col gap-2" autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <div className="filter-group">
          <FilterCombo
            rowKey="app"
            inputId="filter-app"
            label="Jogo"
            icon={Gamepad2}
            shortcut="/"
            filtered={currentFilters.appId !== null}
            inputRef={appInputRef}
            menuRef={appMenuRef}
          />
          <FilterCombo
            rowKey="language"
            inputId="filter-language"
            label="Idioma"
            icon={Languages}
            filtered={currentFilters.language !== null}
            inputRef={languageInputRef}
            menuRef={languageMenuRef}
          />
          <FilterCombo
            rowKey="playtime"
            inputId="filter-playtime"
            label="Tempo na avaliação"
            icon={Timer}
            filtered={currentFilters.playtime !== 'all'}
            inputRef={playtimeInputRef}
            menuRef={playtimeMenuRef}
          />
        </div>

        <div className="filter-group">
          <DateRangeFilter />
        </div>

        <MoreFilters activeCount={moreCount}>
          <div className="filter-group">
            <TriFilterRow
              filterKey="recommended"
              label="Recomendação"
              icon={ThumbsUp}
              value={currentFilters.recommended}
              filtered={currentFilters.recommended !== 'all'}
              onSelect={(tri) => patchFilters({ recommended: readTri(tri) })}
            />
            <TriFilterRow
              filterKey="steamPurchase"
              label="Compra na Steam"
              icon={ShoppingBag}
              value={currentFilters.steamPurchase}
              filtered={currentFilters.steamPurchase !== 'all'}
              onSelect={(tri) => patchFilters({ steamPurchase: readTri(tri) })}
            />
            <TriFilterRow
              filterKey="receivedForFree"
              label="Recebido de graça"
              icon={Gift}
              value={currentFilters.receivedForFree}
              filtered={currentFilters.receivedForFree !== 'all'}
              onSelect={(tri) => patchFilters({ receivedForFree: readTri(tri) })}
            />
            <TriFilterRow
              filterKey="earlyAccess"
              label="Acesso antecipado"
              icon={Rocket}
              value={currentFilters.earlyAccess}
              filtered={currentFilters.earlyAccess !== 'all'}
              onSelect={(tri) => patchFilters({ earlyAccess: readTri(tri) })}
            />
          </div>
        </MoreFilters>
      </form>

      <div className="filters-footer">
        <button
          id="clear-filters"
          type="button"
          className="sidebar-row clear-row"
          title="Limpar filtros"
          aria-keyshortcuts="Shift+X"
          disabled={count === 0}
          onClick={() => resetFilters()}
        >
          <RailIcon icon={Eraser} />
          <span className="sidebar-reveal">
            <span className="sidebar-reveal-inner">Limpar filtros</span>
          </span>
        </button>
        <p id="filter-summary" className="sidebar-summary meta">
          {activeFilterLabel(count)}
        </p>
        <p className="filters-keys">
          <kbd>/</kbd> buscar jogo <span aria-hidden="true">·</span> <kbd>Shift+X</kbd> limpar
        </p>
        <button
          id="apply-filters-mobile"
          type="button"
          className="btn btn-primary w-full md:hidden"
          onClick={() => mobileSidebarOpen.set(false)}
        >
          {mounted && metrics
            ? `Ver ${formatCount(metrics.total_reviews, 'avaliação', 'avaliações')}`
            : 'Ver resultados'}
        </button>
      </div>
    </div>
  );
}

export function FiltersIsland() {
  return (
    <QueryRoot>
      <FiltersContent />
    </QueryRoot>
  );
}
