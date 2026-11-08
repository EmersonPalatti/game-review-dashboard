import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide';
import { atom } from 'nanostores';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { fetchMetrics } from '../../lib/api';
import { RailIcon } from './RailIcon';
import {
  PLACEHOLDER,
  PRESETS,
  THESIS_PRESETS,
  isPresetActive,
  type PresetKey,
} from '../../lib/constants';
import { formatDate, formatPercent, languageLabel } from '../../lib/format';
import { useChatDocked, useFilters, useLatestMetrics } from '../../lib/useNanostore';
import { useHydrated } from '../../lib/useHydrated';
import {
  DEFAULT_SORT,
  PLAYTIME_LABELS,
  activeFilterCount,
  filters,
  resetFilters,
  reviewSort,
  type Filters,
  type ReviewSort,
} from '../../stores/filters';
import { suppressUrlSyncDuring } from '../../stores/urlSync';
import { QueryRoot } from './QueryRoot';

const BASE_FILTERS: Filters = {
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

type ProbeKey = 'refundShort' | 'refundLong' | 'earlyYes' | 'earlyNo';

// Recortes consultados para os números dos achados. A chave ['metrics', filtros] é
// a mesma usada por MetricsIsland, então o cache é compartilhado quando o recorte coincide.
const PRESET_FILTERS: Record<ProbeKey, Filters> = {
  refundShort: PRESETS.refund,
  refundLong: { ...BASE_FILTERS, playtime: 'gte500' },
  earlyYes: PRESETS.early,
  earlyNo: { ...BASE_FILTERS, earlyAccess: 'no' },
};

const gapFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

type FindingCopy = {
  claim: string;
  figure: ReactNode;
  source: string;
};

type FilterChip = {
  label: string;
  value: string;
  clear: () => void;
};

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
}

function buildFilterChips(current: Filters, gameNameById: Map<number, string>): FilterChip[] {
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

  if (current.dateFrom !== null || current.dateTo !== null) {
    let value = '';
    if (current.dateFrom !== null && current.dateTo !== null) {
      value = `${formatDate(current.dateFrom)} a ${formatDate(current.dateTo)}`;
    } else if (current.dateFrom !== null) {
      value = `A partir de ${formatDate(current.dateFrom)}`;
    } else if (current.dateTo !== null) {
      value = `Até ${formatDate(current.dateTo)}`;
    }
    chips.push({
      label: 'Período',
      value,
      clear: () => patchFilters({ dateFrom: null, dateTo: null }),
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

  return chips;
}

/**
 * Recorte do analista guardado antes do primeiro achado. Existe só enquanto um achado está ativo
 * e o recorte não foi editado à mão. Trocar de achado (A → B) mantém o snapshot original.
 */
type FindingSnapshot = {
  filters: Filters;
  sort: ReviewSort;
  /** Achado cujo recorte está aplicado sobre o snapshot. */
  preset: PresetKey;
};

const findingSnapshot = atom<FindingSnapshot | null>(null);

function activeFindingKey(current: Filters): PresetKey | null {
  return THESIS_PRESETS.find((preset) => isPresetActive(current, preset.key))?.key ?? null;
}

/** Aplica o recorte do achado. O recorte do analista só é guardado quando nenhum achado está ativo. */
function applyFinding(preset: PresetKey): void {
  const current = filters.get();
  if (activeFindingKey(current) === null) {
    findingSnapshot.set({ filters: { ...current }, sort: { ...reviewSort.get() }, preset });
  } else {
    const pending = findingSnapshot.get();
    if (pending !== null) findingSnapshot.set({ ...pending, preset });
  }
  suppressUrlSyncDuring(() => {
    reviewSort.set(
      preset === 'dissatisfaction'
        ? { sortBy: 'votes_helpful', sortDir: 'desc' }
        : { ...DEFAULT_SORT },
    );
  });
  filters.set({ ...PRESETS[preset] });
}

/** Devolve o recorte guardado. O snapshot sai antes da troca de filtros para o listener não tratá-la como edição manual. */
function restoreFindingSnapshot(snapshot: FindingSnapshot): void {
  findingSnapshot.set(null);
  suppressUrlSyncDuring(() => {
    reviewSort.set({ ...snapshot.sort });
  });
  filters.set({ ...snapshot.filters });
}

type FindingToggle = 'applied' | 'restored' | 'cleared';

/** Liga ou desliga o achado. Desligar devolve o recorte do analista; sem snapshot, limpa os filtros. */
function toggleFinding(preset: PresetKey): FindingToggle {
  if (!isPresetActive(filters.get(), preset)) {
    applyFinding(preset);
    return 'applied';
  }
  const snapshot = findingSnapshot.get();
  if (snapshot !== null) {
    restoreFindingSnapshot(snapshot);
    return 'restored';
  }
  resetFilters();
  return 'cleared';
}

function useRecommendationRate(probe: ProbeKey): number | undefined {
  // O cache é compartilhado entre ilhas: até hidratar, devolve o mesmo vazio do SSR.
  const hydrated = useHydrated();
  const probeFilters = PRESET_FILTERS[probe];
  const { data } = useQuery({
    queryKey: ['metrics', probeFilters],
    queryFn: () => fetchMetrics(probeFilters),
  });
  return hydrated ? data?.recommendation_rate : undefined;
}

function FindingsStrip() {
  const currentFilters = useFilters();
  const dockedChat = useChatDocked();
  const refundShort = useRecommendationRate('refundShort');
  const refundLong = useRecommendationRate('refundLong');
  const earlyYes = useRecommendationRate('earlyYes');
  const earlyNo = useRecommendationRate('earlyNo');
  const stripRef = useRef<HTMLDivElement>(null);
  const expandedRef = useRef<HTMLDivElement>(null);
  const compactRef = useRef<HTMLDivElement>(null);
  // A grade e a linha compacta trocam de lugar ao aplicar ou limpar um achado; o botão clicado
  // desmonta ou fica inerte, então o foco é devolvido ao botão equivalente do novo layout visível.
  const pendingFocusRef = useRef<PresetKey | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [spinKey, setSpinKey] = useState<PresetKey | null>(null);
  const snapshot = useSyncExternalStore(findingSnapshot.subscribe, findingSnapshot.get, () => null);

  // Só os números usam a fonte mono; o conector (→, vs.) fica na fonte do texto para caber no tile.
  const refundFigure: ReactNode =
    refundShort !== undefined && refundLong !== undefined ? (
      <>
        {formatPercent(refundShort)}
        <span className="finding-figure-sep"> → </span>
        {formatPercent(refundLong)}
      </>
    ) : (
      PLACEHOLDER
    );

  const earlyFigure: ReactNode =
    earlyYes !== undefined && earlyNo !== undefined ? (
      <>
        {formatPercent(earlyYes)}
        <span className="finding-figure-sep"> vs. </span>
        {formatPercent(earlyNo)}
      </>
    ) : (
      PLACEHOLDER
    );

  const earlyGap =
    earlyYes !== undefined && earlyNo !== undefined
      ? gapFormat.format((earlyNo - earlyYes) * 100)
      : PLACEHOLDER;

  const copy: Record<PresetKey, FindingCopy> = {
    refund: {
      claim: 'Na primeira hora, metade recomenda',
      figure: refundFigure,
      source: '< 1 h vs. 500 h+ · janela de reembolso de 2 h',
    },
    early: {
      claim: `Acesso antecipado custa ${earlyGap} p.p.`,
      figure: earlyFigure,
      source: 'taxa de recomendação · em acesso antecipado vs. fora dele',
    },
    dissatisfaction: {
      claim: 'Reviews negativas pesam mais',
      figure: '2,8×',
      source: 'votos úteis por avaliação negativa · fonte: analysis.ipynb',
    },
  };

  const handlePreset = (key: PresetKey): void => {
    const outcome = toggleFinding(key);
    pendingFocusRef.current = key;
    // Border spin: uma volta só, disparada pelo clique (nunca no carregamento com o achado já aplicado).
    setSpinKey(outcome === 'applied' ? key : null);
    if (outcome === 'applied') {
      setAnnouncement(
        `Recorte aplicado: ${copy[key].claim.replace(/\.$/, '')}. Os achados continuam mostrando a base completa.`,
      );
    } else if (outcome === 'restored') {
      setAnnouncement('Recorte do achado removido. Seu recorte anterior voltou.');
    } else {
      setAnnouncement('Recorte do achado removido. Filtros limpos.');
    }
  };

  const handleUndo = (): void => {
    const pending = findingSnapshot.get();
    if (pending === null) return;
    pendingFocusRef.current = pending.preset;
    restoreFindingSnapshot(pending);
    setAnnouncement('Seu recorte anterior foi restaurado.');
  };

  const hasActiveFilters = activeFilterCount(currentFilters) > 0;
  const findingActive = activeFindingKey(currentFilters) !== null;
  const undoAvailable =
    snapshot !== null &&
    isPresetActive(currentFilters, snapshot.preset) &&
    activeFilterCount(snapshot.filters) > 0;

  // Qualquer edição manual que tire o achado do ar descarta o snapshot: ele já não descreve o recorte atual.
  useEffect(
    () =>
      filters.listen((next) => {
        const pending = findingSnapshot.get();
        if (pending !== null && !isPresetActive(next, pending.preset)) {
          findingSnapshot.set(null);
        }
      }),
    [],
  );

  const collapsed = hasActiveFilters || dockedChat;

  // Quando o usuário clica num achado, o layout troca entre expandido e compacto. O foco é transferido
  // para o botão equivalente no layout ativo (compactRef se collapsed, senão expandedRef).
  // pendingFocusRef só é definido em handlePreset e handleUndo, garantindo que abrir/fechar o dock do chat
  // nunca roube o foco.
  useEffect(() => {
    const key = pendingFocusRef.current;
    if (key === null) return;
    pendingFocusRef.current = null;
    const target = (collapsed ? compactRef.current : expandedRef.current)?.querySelector<HTMLButtonElement>(
      `button[data-preset="${key}"]`,
    );
    target?.focus();
  }, [currentFilters, collapsed]);

  return (
    <div
      ref={stripRef}
      id="thesis-presets"
      className={`findings-strip ${collapsed ? 'is-collapsed' : 'is-expanded'}`}
      role="group"
      aria-label={
        hasActiveFilters
          ? 'Achados do estudo · Achados da base completa · não seguem o filtro'
          : 'Achados do estudo'
      }
    >
      <span id="findings-preset-desc" className="sr-only">
        Aplica o recorte deste achado e substitui os filtros atuais. Pode ser desfeito: clicar de novo, ou em
        Desfazer, restaura o seu recorte anterior.
      </span>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="findings-drawer">
        <div
          ref={expandedRef}
          className="findings-slot findings-slot-expanded"
          inert={collapsed ? true : undefined}
          aria-hidden={collapsed ? 'true' : 'false'}
        >
          <div className="findings-slot-inner">
            <div className="findings-grid">
              {THESIS_PRESETS.map((preset) => {
                const tile = copy[preset.key];
                const isActive = isPresetActive(currentFilters, preset.key);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className="finding-tile"
                    data-preset={preset.key}
                    aria-pressed={isActive ? 'true' : 'false'}
                    aria-describedby="findings-preset-desc"
                    title={preset.title}
                    onClick={() => handlePreset(preset.key)}
                  >
                    <span className="finding-figure">{tile.figure}</span>
                    <span className="finding-claim">{tile.claim}</span>
                    <span className="finding-source">{tile.source}</span>
                    {/* O tile inteiro é o botão; a seta só sinaliza que ele aplica um recorte. */}
                    <RailIcon icon={ArrowRight} className="finding-action-icon" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          ref={compactRef}
          className="findings-slot findings-slot-compact"
          inert={!collapsed ? true : undefined}
          aria-hidden={!collapsed ? 'true' : 'false'}
        >
          <div className="findings-slot-inner">
            {/* Com o chat acoplado e sem filtro, não há recorte a contrastar: a nota só vale com filtro ativo. */}
            {/* Os tiles expandidos ficam inertes com filtro ativo, então o aviso de substituição vive aqui. */}
            {/* O escopo (base completa) fica no cabeçalho da faixa; aqui só o aviso de substituição e o Desfazer. */}
            {(hasActiveFilters && !findingActive) || undoAvailable ? (
              <div className="findings-scope-row">
                {!findingActive ? (
                  <p className="meta findings-scope-note">Clicar em um achado substitui seus filtros</p>
                ) : null}
                {undoAvailable ? (
                  <button type="button" className="findings-undo" onClick={handleUndo}>
                    Desfazer · voltar ao seu recorte
                  </button>
                ) : null}
              </div>
            ) : null}
            <div className="findings-compact-row">
              {THESIS_PRESETS.map((preset) => {
                const tile = copy[preset.key];
                const isActive = isPresetActive(currentFilters, preset.key);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className={`finding-compact-btn${isActive && spinKey === preset.key ? ' is-spinning' : ''}`}
                    data-preset={preset.key}
                    aria-pressed={isActive ? 'true' : 'false'}
                    aria-describedby="findings-preset-desc"
                    title={preset.title}
                    onClick={() => handlePreset(preset.key)}
                    onAnimationEnd={(event) => {
                      if (event.animationName === 'border-spin-fade') setSpinKey(null);
                    }}
                  >
                    <span className="finding-compact-claim">{tile.claim}</span>
                    <span className="finding-compact-figure">{tile.figure}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function chipKey(chip: FilterChip): string {
  return `${chip.label}:${chip.value}`;
}

const EMPTY_KEYS: ReadonlySet<string> = new Set();

/**
 * Chips de filtro ativos. Os que já estão no primeiro commit pós-hidratação (ex.: filtros vindos da URL)
 * não animam; os que entram depois, por interação, recebem `is-entering` até o fim da animação.
 */
function FilterChips({ chips, onResetAll }: { chips: FilterChip[]; onResetAll: () => void }) {
  // Chaves do commit anterior. null até o primeiro commit: é o "já assentou", e esse commit não anima.
  const previousKeysRef = useRef<ReadonlySet<string> | null>(null);
  const [enteringKeys, setEnteringKeys] = useState<ReadonlySet<string>>(EMPTY_KEYS);

  // Layout effect: a classe entra antes da pintura, então o chip novo não aparece por um frame sem animação.
  useLayoutEffect(() => {
    const keys = new Set(chips.map(chipKey));
    const previousKeys = previousKeysRef.current;
    previousKeysRef.current = keys;
    if (previousKeys === null) return;

    const added = [...keys].filter((key) => !previousKeys.has(key));
    if (added.length === 0) return;
    setEnteringKeys((current) => new Set([...current, ...added]));
  }, [chips]);

  const finishEntering = (key: string): void => {
    setEnteringKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  if (chips.length === 0) {
    return <span className="meta">Base completa · nenhum filtro ativo</span>;
  }

  return (
    <>
      {chips.map((chip) => {
        const key = chipKey(chip);
        return (
          <button
            key={key}
            type="button"
            className={enteringKeys.has(key) ? 'filter-chip is-entering' : 'filter-chip'}
            aria-label={`Remover filtro ${chip.label}: ${chip.value}`}
            onClick={() => chip.clear()}
            onAnimationEnd={() => finishEntering(key)}
          >
            <span className="filter-chip-label">{`${chip.label}:`}</span>
            <span className="filter-chip-value">{chip.value}</span>
            <span className="filter-chip-remove" aria-hidden="true">
              ×
            </span>
          </button>
        );
      })}
      {chips.length >= 2 ? (
        <button type="button" className="filter-chip is-reset" onClick={() => onResetAll()}>
          Limpar todos
        </button>
      ) : null}
    </>
  );
}

function ContextContent() {
  const currentFilters = useFilters();
  const metrics = useLatestMetrics();
  // Antes de hidratar o container sai vazio, como no HTML do servidor: sem "Base completa" piscando
  // quando a URL já traz filtros.
  const hydrated = useHydrated();

  const gameNameById = useMemo(() => {
    const map = new Map<number, string>();
    if (metrics) {
      for (const game of metrics.games) {
        map.set(game.app_id, game.app_name);
      }
    }
    return map;
  }, [metrics]);

  const chips = useMemo(
    () => buildFilterChips(currentFilters, gameNameById),
    [currentFilters, gameNameById],
  );

  return (
    <div id="active-chips" className="active-chips" aria-live="polite">
      {hydrated ? <FilterChips chips={chips} onResetAll={resetFilters} /> : null}
    </div>
  );
}

export function ContextIsland() {
  return (
    <QueryRoot>
      <ContextContent />
    </QueryRoot>
  );
}

export function FindingsIsland() {
  return (
    <QueryRoot>
      <FindingsStrip />
    </QueryRoot>
  );
}
