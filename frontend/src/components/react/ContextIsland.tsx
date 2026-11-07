import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { fetchMetrics } from '../../lib/api';
import {
  PLACEHOLDER,
  PRESETS,
  THESIS_PRESETS,
  isPresetActive,
  type PresetKey,
} from '../../lib/constants';
import { formatDate, formatPercent, languageLabel } from '../../lib/format';
import { useFilters, useLatestMetrics } from '../../lib/useNanostore';
import { renderFilterChips, type FilterChip } from '../../scripts/renderers';
import {
  DEFAULT_SORT,
  PLAYTIME_LABELS,
  filters,
  resetFilters,
  reviewSort,
  type Filters,
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

function applyPreset(preset: PresetKey): void {
  if (isPresetActive(filters.get(), preset)) {
    resetFilters();
    return;
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

function useRecommendationRate(probe: ProbeKey): number | undefined {
  const probeFilters = PRESET_FILTERS[probe];
  const { data } = useQuery({
    queryKey: ['metrics', probeFilters],
    queryFn: () => fetchMetrics(probeFilters),
  });
  return data?.recommendation_rate;
}

function FindingsStrip({ currentFilters }: { currentFilters: Filters }) {
  const refundShort = useRecommendationRate('refundShort');
  const refundLong = useRecommendationRate('refundLong');
  const earlyYes = useRecommendationRate('earlyYes');
  const earlyNo = useRecommendationRate('earlyNo');

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

  const hasActiveFilters =
    currentFilters.appId !== null ||
    currentFilters.language !== null ||
    currentFilters.dateFrom !== null ||
    currentFilters.dateTo !== null ||
    currentFilters.recommended !== 'all' ||
    currentFilters.steamPurchase !== 'all' ||
    currentFilters.receivedForFree !== 'all' ||
    currentFilters.earlyAccess !== 'all' ||
    currentFilters.playtime !== 'all';

  return (
    <div
      id="thesis-presets"
      className="findings-strip"
      role="group"
      aria-label={
        hasActiveFilters
          ? 'Achados do estudo · Achados da base completa · não seguem o filtro'
          : 'Achados do estudo'
      }
    >
      {hasActiveFilters && (
        <p className="findings-scope-note">Achados da base completa · não seguem o filtro</p>
      )}
      <div className="findings-grid">
        {THESIS_PRESETS.map((preset) => {
          const tile = copy[preset.key];
          return (
            <button
              key={preset.key}
              type="button"
              className="finding-tile"
              data-preset={preset.key}
              aria-pressed={isPresetActive(currentFilters, preset.key) ? 'true' : 'false'}
              title={preset.title}
              onClick={() => applyPreset(preset.key)}
            >
              <span className="finding-claim">{tile.claim}</span>
              <span className="finding-figure">{tile.figure}</span>
              <span className="finding-source">{tile.source}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ContextContent() {
  const currentFilters = useFilters();
  const metrics = useLatestMetrics();
  const chipsRef = useRef<HTMLDivElement>(null);

  const gameNameById = useMemo(() => {
    const map = new Map<number, string>();
    if (metrics) {
      for (const game of metrics.games) {
        map.set(game.app_id, game.app_name);
      }
    }
    return map;
  }, [metrics]);

  useEffect(() => {
    const container = chipsRef.current;
    if (!container) return;
    const chips = buildFilterChips(currentFilters, gameNameById);
    renderFilterChips(container, chips, () => {
      resetFilters();
    });
  }, [currentFilters, gameNameById]);

  return (
    <>
      <div ref={chipsRef} id="active-chips" className="active-chips" aria-live="polite" />
      <FindingsStrip currentFilters={currentFilters} />
    </>
  );
}

export function ContextIsland() {
  return (
    <QueryRoot>
      <ContextContent />
    </QueryRoot>
  );
}
