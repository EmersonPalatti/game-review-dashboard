import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useFilters, useLatestMetrics } from '../../lib/useNanostore';
import { useHydrated } from '../../lib/useHydrated';
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

const DOCKED_CHAT_MEDIA_QUERY = '(min-width: 1280px)';

/**
 * Observa se o SteamBot está acoplado lateralmente (viewport >= 1280px e data-chat-dock="open").
 * O atributo é controlado pelo ChatIsland no elemento raiz document.documentElement.
 * SSR-safe: devolve false no servidor e na primeira renderização para bater com o HTML hidratado.
 */
function useDockedChat(): boolean {
  const [isDocked, setIsDocked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const mq = window.matchMedia(DOCKED_CHAT_MEDIA_QUERY);

    function update(): void {
      const isChatDockOpen = document.documentElement.getAttribute('data-chat-dock') === 'open';
      setIsDocked(isChatDockOpen && mq.matches);
    }

    update();

    const observer = new MutationObserver(() => {
      update();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chat-dock'],
    });

    mq.addEventListener('change', update);

    return () => {
      observer.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);

  return isDocked;
}

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

/** Aplica o recorte do achado (ou limpa, se já ativo). Retorna true quando o recorte foi aplicado. */
function applyPreset(preset: PresetKey): boolean {
  if (isPresetActive(filters.get(), preset)) {
    resetFilters();
    return false;
  }
  suppressUrlSyncDuring(() => {
    reviewSort.set(
      preset === 'dissatisfaction'
        ? { sortBy: 'votes_helpful', sortDir: 'desc' }
        : { ...DEFAULT_SORT },
    );
  });
  filters.set({ ...PRESETS[preset] });
  return true;
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
  const dockedChat = useDockedChat();
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
    const applied = applyPreset(key);
    pendingFocusRef.current = key;
    setAnnouncement(
      applied
        ? `Recorte aplicado: ${copy[key].claim}. Os achados continuam mostrando a base completa.`
        : 'Recorte do achado removido. Filtros limpos.',
    );
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

  const collapsed = hasActiveFilters || dockedChat;

  // Quando o usuário clica num achado, o layout troca entre expandido e compacto. O foco é transferido
  // para o botão equivalente no layout ativo (compactRef se collapsed, senão expandedRef).
  // pendingFocusRef só é definido em handlePreset, garantindo que abrir/fechar o dock do chat
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
        Aplica o recorte deste achado e substitui os filtros atuais.
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
                    <span className="finding-claim">{tile.claim}</span>
                    <span className="finding-figure">{tile.figure}</span>
                    <span className="finding-source">{tile.source}</span>
                    <span className="finding-action">
                      {isActive ? (
                        'Limpar recorte'
                      ) : (
                        <>
                          Ver recorte
                          <RailIcon icon={ArrowRight} className="finding-action-icon" />
                        </>
                      )}
                    </span>
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
            {hasActiveFilters ? (
              <p className="meta findings-scope-note">Achados da base completa · não seguem o filtro</p>
            ) : null}
            <div className="findings-compact-row">
              {THESIS_PRESETS.map((preset) => {
                const tile = copy[preset.key];
                const isActive = isPresetActive(currentFilters, preset.key);
                return (
                  <button
                    key={preset.key}
                    type="button"
                    className="finding-compact-btn"
                    data-preset={preset.key}
                    aria-pressed={isActive ? 'true' : 'false'}
                    aria-describedby="findings-preset-desc"
                    title={preset.title}
                    onClick={() => handlePreset(preset.key)}
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
    <div ref={chipsRef} id="active-chips" className="active-chips" aria-live="polite" />
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
