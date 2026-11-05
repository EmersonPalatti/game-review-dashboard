import {
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
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { PLAYTIME_OPTIONS } from '../../lib/constants';
import { formatInteger, languageLabel } from '../../lib/format';
import { useFilters, useLatestMetrics } from '../../lib/useNanostore';
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

type CombosRef = {
  app: SearchCombo;
  language: SearchCombo;
  playtime: SearchCombo;
};

export function FiltersIsland() {
  const currentFilters = useFilters();
  const metrics = useLatestMetrics();

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

    const gameOptions = metrics.games.map((game) => ({
      value: String(game.app_id),
      label: game.app_name,
      count: game.review_count,
    }));
    const gameKey = catalogSignature(gameOptions);
    if (gameKey !== gamesSignatureRef.current) {
      gamesSignatureRef.current = gameKey;
      combos.app.setOptions(gameOptions);
    }

    const languageOptions = metrics.languages.map((entry) => ({
      value: entry.language,
      label: languageLabel(entry.language),
      count: entry.review_count,
    }));
    const languageKey = catalogSignature(languageOptions);
    if (languageKey !== languagesSignatureRef.current) {
      languagesSignatureRef.current = languageKey;
      combos.language.setOptions(languageOptions);
    }
  }, [metrics]);

  const count = activeFilterCount(currentFilters);

  return (
    <>
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

        <div className="filter-group">
          <TriFilterRow
            filterKey="recommended"
            label="Recomendação"
            icon={ThumbsUp}
            value={currentFilters.recommended}
            filtered={currentFilters.recommended !== 'all'}
            onSelect={(tri) => patchFilters({ recommended: readTri(tri) })}
          />
        </div>

        <div className="filter-group">
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
      </form>
      <button
        id="clear-filters"
        type="button"
        className="sidebar-row clear-row mt-4"
        title="Limpar filtros"
        onClick={() => resetFilters()}
      >
        <RailIcon icon={Eraser} />
        <span className="sidebar-reveal">
          <span className="sidebar-reveal-inner">Limpar filtros</span>
        </span>
      </button>
      <p id="filter-summary" className="sidebar-summary meta mt-2">
        {activeFilterLabel(count)}
      </p>
      <div className="sidebar-mobile-actions mt-4 md:hidden">
        <button
          id="apply-filters-mobile"
          type="button"
          className="btn btn-primary w-full"
          onClick={() => document.dispatchEvent(new CustomEvent('close-mobile-sidebar'))}
        >
          {metrics ? `Ver ${formatInteger(metrics.total_reviews)} avaliações` : 'Ver resultados'}
        </button>
      </div>
    </>
  );
}
