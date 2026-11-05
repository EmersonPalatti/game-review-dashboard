import { useEffect, useMemo, useRef } from 'react';
import { PRESETS, THESIS_PRESETS, isPresetActive, type PresetKey } from '../../lib/constants';
import { languageLabel } from '../../lib/format';
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

export function ContextIsland() {
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
      <div id="thesis-presets" className="preset-bar" role="group" aria-label="Recortes guiados da análise">
        <span className="meta">Recortes do estudo:</span>
        {THESIS_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            className="preset-btn"
            data-preset={preset.key}
            aria-pressed={isPresetActive(currentFilters, preset.key) ? 'true' : 'false'}
            title={preset.title}
            onClick={() => applyPreset(preset.key)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </>
  );
}
