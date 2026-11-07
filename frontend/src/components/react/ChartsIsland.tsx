import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchCharts,
  fetchFacets,
  fetchMetrics,
  type GameBar,
  type LanguageBar,
  type MonthPoint,
  type PlaytimePoint,
} from '../../lib/api';
import { useDelayedFlag } from '../../lib/fetchFeedback';
import { BASELINE_RATE, PLACEHOLDER, REFUND_BUCKETS } from '../../lib/constants';
import { formatCount, formatInteger, formatPercent, languageLabel } from '../../lib/format';
import { useFilters } from '../../lib/useNanostore';
import { useHydrated } from '../../lib/useHydrated';
import { useGridReflowMotion } from '../../lib/useGridReflowMotion';
import {
  disposeCharts,
  formatMonth,
  initCharts,
  renderCharts,
  setMonthMetric,
  type MonthMetric,
} from '../../scripts/charts';
import { rankRow } from '../../scripts/renderers';
import {
  filters,
  getActiveMonth,
  getMonthDateRange,
  isPlaytimeBucket,
  type Filters,
  type PlaytimeBucket,
} from '../../stores/filters';
import { QueryRoot } from './QueryRoot';
import { EmptyState } from './EmptyState';

const RANK_GAMES_LIMIT = 8;

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
}

function togglePlaytime(bucket: PlaytimeBucket): void {
  const current = filters.get().playtime;
  patchFilters({ playtime: current === bucket ? 'all' : bucket });
}

function toggleMonth(month: string): void {
  const current = filters.get();
  const currentMonth = getActiveMonth(current.dateFrom, current.dateTo);
  if (currentMonth === month) {
    patchFilters({ dateFrom: null, dateTo: null });
  } else {
    patchFilters(getMonthDateRange(month));
  }
}

type GameRankItem = {
  appId: number | null;
  appName: string;
  reviewCount: number;
};

function renderGameRanks(
  container: HTMLOListElement,
  games: GameRankItem[],
  currentAppId: number | null,
): void {
  container.replaceChildren();
  const max = Math.max(...games.map((game) => game.reviewCount), 1);
  games.forEach((game, index) => {
    const selected = game.appId !== null && currentAppId === game.appId;
    container.append(
      rankRow(
        `game:${game.appName}`,
        index,
        game.appName,
        formatInteger(game.reviewCount),
        (game.reviewCount / max) * 100,
        {
          title: game.appName,
          selected,
          ariaLabel: `${game.appName}: ${formatCount(game.reviewCount, 'avaliação', 'avaliações')}`,
          onSelect: () => {
            if (game.appId !== null) {
              patchFilters({ appId: selected ? null : game.appId });
            }
          },
        },
      ),
    );
  });
}

function compareLanguagesByApproval(a: LanguageBar, b: LanguageBar): number {
  return (
    (b.recommendation_rate ?? -1) - (a.recommendation_rate ?? -1) ||
    b.review_count - a.review_count
  );
}

const ppFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function renderLanguageRanks(
  container: HTMLOListElement,
  languages: LanguageBar[],
  currentLanguage: string | null,
): void {
  container.replaceChildren();
  const sorted = [...languages].sort(compareLanguagesByApproval);
  const deltas = sorted
    .filter((item) => item.recommendation_rate !== null)
    .map((item) => Math.abs(item.recommendation_rate! - BASELINE_RATE));
  const maxDelta = deltas.length > 0 ? Math.max(...deltas) : 0;
  // Escala pelo maior |delta|, com piso de 5 p.p. (0.05) para não distorcer variações mínimas.
  const scaleMax = Math.max(maxDelta, 0.05);

  sorted.forEach((item, index) => {
    const selected = currentLanguage === item.language;
    const rate = item.recommendation_rate;
    const name = languageLabel(item.language);

    let valueText = PLACEHOLDER;
    let signedValue = 0;
    if (rate !== null) {
      const diffPp = (rate - BASELINE_RATE) * 100;
      const formattedPp = ppFormat.format(Math.abs(diffPp) < 0.005 ? 0 : diffPp);
      valueText = `${formatPercent(rate)} · ${formattedPp} p.p.`;
      signedValue = Math.max(-1, Math.min(1, (rate - BASELINE_RATE) / scaleMax));
    }

    const reviewText = formatCount(item.review_count, 'avaliação', 'avaliações');

    container.append(
      rankRow(
        `lang:${item.language}`,
        index,
        name,
        valueText,
        0,
        {
          title: `${name}: ${reviewText}`,
          selected,
          ariaLabel:
            rate === null
              ? `${name}: sem avaliações, ${reviewText}`
              : `${name}: ${valueText}, ${reviewText}`,
          onSelect: () => {
            patchFilters({ language: selected ? null : item.language });
          },
          variant: 'diverging',
          signedValue,
        },
      ),
    );
  });
}

type PlaytimeLegendProps = {
  rows: PlaytimePoint[];
  active: PlaytimeBucket;
  onToggle: (bucket: PlaytimeBucket) => void;
};

function PlaytimeLegend({ rows, active, onToggle }: PlaytimeLegendProps) {
  // Filtra faixas válidas e separa o par da janela de reembolso (<= 2 h)
  const validRows = rows.filter((row) => isPlaytimeBucket(row.key));
  const refundRows = validRows.filter((row) => REFUND_BUCKETS.includes(row.key as PlaytimeBucket));
  const otherRows = validRows.filter((row) => !REFUND_BUCKETS.includes(row.key as PlaytimeBucket));

  const renderChip = (row: PlaytimePoint) => {
    const bucket = row.key as PlaytimeBucket;
    const refund = REFUND_BUCKETS.includes(bucket);
    const rate =
      row.recommendation_rate === null
        ? PLACEHOLDER
        : formatPercent(row.recommendation_rate);
    const rateName = row.recommendation_rate === null ? 'sem dados' : rate;
    const valueOnly = row.label.replace(/\s*h$/, '');

    return (
      <button
        key={row.key}
        type="button"
        className="playtime-chip"
        aria-pressed={active === bucket}
        aria-label={`${row.label} ${rateName}${refund ? ', janela de reembolso' : ''}`}
        title={`${row.label}: ${rateName} · ${formatCount(row.review_count, 'avaliação', 'avaliações')}`}
        onClick={() => onToggle(bucket)}
      >
        <span className="playtime-chip-label">
          {refund ? <span className="playtime-chip-dot" aria-hidden="true" /> : null}
          <span className="playtime-chip-num">{valueOnly}</span>
          <span className="playtime-chip-unit"> h</span>
        </span>
      </button>
    );
  };

  return (
    <div className="playtime-legend-container">
      <div className="playtime-legend" role="group" aria-label="Filtrar por faixa de tempo de jogo">
        {refundRows.length === 2 ? (
          <div className="playtime-refund-band" title="Janela de reembolso Steam (até 2 horas)">
            {refundRows.map(renderChip)}
          </div>
        ) : (
          refundRows.map(renderChip)
        )}
        {otherRows.map(renderChip)}
      </div>
      <div className="playtime-legend-footer" aria-hidden="true">
        <span className="playtime-legend-refund-hint">
          <span className="playtime-chip-dot" /> até 2 h: janela de reembolso
        </span>
        <span className="playtime-legend-unit-hint">horas jogadas</span>
      </div>
    </div>
  );
}

function PlaytimeRanks({ rows, active, onToggle }: PlaytimeLegendProps) {
  const deltas = rows
    .filter((row) => row.recommendation_rate !== null)
    .map((row) => Math.abs(row.recommendation_rate! - BASELINE_RATE));
  const maxDelta = deltas.length > 0 ? Math.max(...deltas) : 0;
  // Escala pelo maior |delta|, com piso de 5 p.p. (0.05) para não distorcer variações mínimas.
  const scaleMax = Math.max(maxDelta, 0.05);

  return (
    <ol className="rank-list" aria-label="Recomendação por faixa de tempo de jogo">
      {rows.map((row) => {
        if (!isPlaytimeBucket(row.key)) return null;
        const bucket = row.key;
        const selected = active === bucket;
        const refund = REFUND_BUCKETS.includes(bucket);
        const rate = row.recommendation_rate;
        const displayLabel = row.label === '500+ h' ? '500 h+' : row.label;

        let valueText = PLACEHOLDER;
        let signedValue = 0;
        let fillClass: string | null = null;
        let targetScale = 0;

        if (rate !== null) {
          const diffPp = (rate - BASELINE_RATE) * 100;
          const formattedPp = ppFormat.format(Math.abs(diffPp) < 0.005 ? 0 : diffPp);
          valueText = `${formatPercent(rate)} · ${formattedPp} p.p.`;
          signedValue = Math.max(-1, Math.min(1, (rate - BASELINE_RATE) / scaleMax));

          if (signedValue > 0) {
            fillClass = 'rank-fill rank-fill-positive';
            targetScale = Math.min(1, signedValue);
          } else if (signedValue < 0) {
            fillClass = 'rank-fill rank-fill-negative';
            targetScale = Math.min(1, Math.abs(signedValue));
          }
        }

        const reviewText = formatCount(row.review_count, 'avaliação', 'avaliações');
        const refundSuffix = refund ? ', janela de reembolso' : '';
        const rateName = rate === null ? 'sem dados' : formatPercent(rate);
        const ariaLabel =
          rate === null
            ? `${displayLabel}: sem avaliações, ${reviewText}${refundSuffix}`
            : `${displayLabel}: ${valueText}, ${reviewText}${refundSuffix}`;
        const title = `${displayLabel}: ${rateName} · ${reviewText}${refundSuffix}`;

        return (
          <li key={bucket} className="rank-item">
            <button
              type="button"
              className={`rank-row w-full text-left${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              aria-label={ariaLabel}
              title={title}
              onClick={() => onToggle(bucket)}
            >
              <div className="rank-line">
                <span className="min-w-0 flex-1 truncate flex items-center whitespace-nowrap">
                  {refund ? <span className="rank-dot-negative" aria-hidden="true" /> : null}
                  <span className="playtime-rank-name">{displayLabel}</span>
                </span>
                <span className="rank-value">{valueText}</span>
              </div>
              <div className="rank-track rank-track-diverging" aria-hidden="true">
                {fillClass ? (
                  <div
                    className={fillClass}
                    style={{ transform: `scaleX(${targetScale})` }}
                  />
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function MonthTable({ months }: { months: MonthPoint[] }) {
  return (
    <table className="sr-only">
      <caption>Avaliações por mês</caption>
      <thead>
        <tr>
          <th scope="col">Mês</th>
          <th scope="col">Avaliações</th>
          <th scope="col">Recomendação</th>
        </tr>
      </thead>
      <tbody>
        {months.map((point) => {
          const rate = point.recommendation_rate;
          return (
            <tr key={point.month}>
              <th scope="row">{formatMonth(point.month)}</th>
              <td>{formatInteger(point.review_count)}</td>
              <td>{rate !== null && rate !== undefined ? formatPercent(rate) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const MONTH_METRIC_SUBTITLES: ReadonlyArray<{ metric: MonthMetric; text: string }> = [
  { metric: 'volume', text: 'Publicadas em cada mês do recorte · clique em um mês para filtrar' },
  {
    metric: 'approval',
    text: 'Percentual que recomenda em cada mês · meses com menos de 30 avaliações ficam de fora · clique em um mês para filtrar',
  },
];

function ChartsContent() {
  const currentFilters = useFilters();
  const [monthMetric, setMonthMetricState] = useState<MonthMetric>('volume');

  const handleMonthMetricChange = (metric: MonthMetric) => {
    setMonthMetricState(metric);
    setMonthMetric(metric);
  };

  const metricsKey = useMemo(() => ['metrics', currentFilters] as const, [currentFilters]);
  const chartsKey = useMemo(() => ['charts', currentFilters] as const, [currentFilters]);
  const gameRanksRef = useRef<HTMLOListElement>(null);
  const languageRanksRef = useRef<HTMLOListElement>(null);
  const gridRef = useRef<HTMLElement>(null);
  useGridReflowMotion(gridRef);

  const { data: metricsData } = useQuery({
    queryKey: metricsKey,
    queryFn: () => fetchMetrics(currentFilters),
    placeholderData: keepPreviousData,
  });

  const {
    data: chartsData,
    error,
    isFetching: chartsFetching,
    refetch,
  } = useQuery({
    queryKey: chartsKey,
    queryFn: () => fetchCharts(currentFilters),
    placeholderData: keepPreviousData,
  });

  const { data: facetsData } = useQuery({
    queryKey: ['facets', currentFilters],
    queryFn: () => fetchFacets(currentFilters),
    placeholderData: keepPreviousData,
  });

  const mounted = useHydrated();

  const showBusyFlag = useDelayedFlag(chartsFetching);
  const showBusy = mounted && showBusyFlag;
  const activeMonth = getActiveMonth(currentFilters.dateFrom, currentFilters.dateTo);
  const dateFilterActive = currentFilters.dateFrom !== null || currentFilters.dateTo !== null;

  const effectiveChartsData = mounted ? chartsData : undefined;
  const effectiveFacetsData = mounted ? facetsData : undefined;

  // Empty states are derived here once; each card collapses its chart area and shows one line.
  const monthEmpty = effectiveChartsData !== undefined && effectiveChartsData.months.length === 0;
  const playtimeEmpty =
    effectiveChartsData !== undefined && !effectiveChartsData.playtime.some((point) => point.review_count > 0);
  const gamesEmpty =
    currentFilters.appId !== null && effectiveFacetsData !== undefined
      ? !effectiveFacetsData.games.some((point) => point.review_count > 0)
      : effectiveChartsData !== undefined && effectiveChartsData.games.length === 0;
  const languagesEmpty =
    effectiveChartsData !== undefined && !effectiveChartsData.languages.some((point) => point.review_count > 0);

  const gameRankNote = useMemo(() => {
    if (!mounted || currentFilters.appId === null) return null;
    if (!effectiveFacetsData) {
      return 'Filtro de jogo ativo · clique para voltar ao ranking completo';
    }
    const withReviews = effectiveFacetsData.games
      .filter((game) => game.review_count > 0)
      .sort((a, b) => b.review_count - a.review_count);
    const total = withReviews.length;
    const index = withReviews.findIndex((game) => game.app_id === currentFilters.appId);
    if (index < 0) {
      // Jogo sem avaliações no recorte: não tem posição no ranking.
      return 'Jogo destacado sem avaliações neste recorte · clique nele para limpar';
    }
    return `${formatInteger(index + 1)}º de ${formatInteger(total)} em volume · clique no jogo destacado para limpar`;
  }, [mounted, currentFilters.appId, effectiveFacetsData]);

  const languageRankNote = useMemo(() => {
    if (!mounted || currentFilters.language === null) return null;
    if (!effectiveChartsData) {
      return 'Filtro de idioma ativo · clique para voltar ao ranking completo';
    }
    const withReviews = effectiveChartsData.languages
      .filter((lang) => lang.review_count > 0 && lang.recommendation_rate !== null)
      .sort(compareLanguagesByApproval);
    const total = withReviews.length;
    const index = withReviews.findIndex((lang) => lang.language === currentFilters.language);
    if (index < 0) {
      // Idioma sem avaliações no recorte: não tem posição no ranking.
      return 'Idioma destacado sem avaliações neste recorte · clique nele para limpar';
    }
    return `${formatInteger(index + 1)}º de ${formatInteger(total)} em aprovação · clique no idioma destacado para limpar`;
  }, [mounted, currentFilters.language, effectiveChartsData]);

  useEffect(() => {
    initCharts(togglePlaytime, toggleMonth);
    return () => {
      disposeCharts();
    };
  }, []);

  useEffect(() => {
    if (chartsData) {
      renderCharts(chartsData, currentFilters.playtime, activeMonth, dateFilterActive);
    }
  }, [chartsData, currentFilters.playtime, activeMonth, dateFilterActive]);

  useEffect(() => {
    const rankGames = gameRanksRef.current;
    const rankLanguages = languageRanksRef.current;
    if (!rankGames || !rankLanguages) return;
    if (!chartsData) {
      rankGames.replaceChildren();
      rankLanguages.replaceChildren();
      return;
    }

    const appIdByName = new Map<string, number>();
    const appNameById = new Map<number, string>();
    if (metricsData) {
      for (const game of metricsData.games) {
        appIdByName.set(game.app_name, game.app_id);
        appNameById.set(game.app_id, game.app_name);
      }
    }

    let gameItems: GameRankItem[];
    if (currentFilters.appId !== null && facetsData) {
      const withReviews = facetsData.games
        .filter((game) => game.review_count > 0)
        .sort((a, b) => b.review_count - a.review_count);
      const topGames = withReviews.slice(0, RANK_GAMES_LIMIT);
      const selectedInTop = topGames.some((game) => game.app_id === currentFilters.appId);
      const listToRender = selectedInTop
        ? topGames
        : [
            ...topGames,
            facetsData.games.find((game) => game.app_id === currentFilters.appId) ?? {
              app_id: currentFilters.appId,
              review_count: 0,
            },
          ];

      gameItems = listToRender.map((game) => ({
        appId: game.app_id,
        appName:
          appNameById.get(game.app_id) ??
          chartsData.games.find((cg) => cg.app_name && appIdByName.get(cg.app_name) === game.app_id)?.app_name ??
          (chartsData.games.length === 1 && currentFilters.appId === game.app_id
            ? chartsData.games[0].app_name
            : `Jogo #${game.app_id}`),
        reviewCount: game.review_count,
      }));
    } else {
      gameItems = chartsData.games.map((game) => ({
        appId:
          appIdByName.get(game.app_name) ??
          (currentFilters.appId !== null && chartsData.games.length === 1 ? currentFilters.appId : null),
        appName: game.app_name,
        reviewCount: game.review_count,
      }));
    }

    renderGameRanks(rankGames, gameItems, currentFilters.appId);
    renderLanguageRanks(rankLanguages, chartsData.languages, currentFilters.language);
  }, [chartsData, metricsData, facetsData, currentFilters.appId, currentFilters.language]);

  return (
    <div className="charts-shell">
      <section
        ref={gridRef}
        className="charts-grid"
        aria-label="Gráficos"
        data-fetching={showBusy ? 'true' : 'false'}
        aria-busy={showBusy}
      >
        <article className="card charts-col-span-2">
          <div className="chart-card-header">
            <div>
              <h2 className="title">
                {monthMetric === 'approval' ? 'Aprovação por mês' : 'Avaliações por mês'}
              </h2>
              {/* As duas legendas ocupam a mesma célula: o cabeçalho reserva a mais alta e
                  a troca de métrica não desloca o seletor nem o gráfico. */}
              <div className="chart-card-subtitle mt-2">
                {MONTH_METRIC_SUBTITLES.map(({ metric, text }) => (
                  <p
                    key={metric}
                    className="meta"
                    data-active={metric === monthMetric ? 'true' : 'false'}
                  >
                    {text}
                  </p>
                ))}
              </div>
            </div>
            <div
              className="seg-control chart-month-toggle"
              role="group"
              aria-label="Métrica do gráfico mensal"
            >
              <button
                type="button"
                className="seg-btn"
                aria-pressed={monthMetric === 'volume' ? 'true' : 'false'}
                onClick={() => handleMonthMetricChange('volume')}
              >
                Volume
              </button>
              <button
                type="button"
                className="seg-btn"
                aria-pressed={monthMetric === 'approval' ? 'true' : 'false'}
                onClick={() => handleMonthMetricChange('approval')}
              >
                Aprovação
              </button>
            </div>
          </div>
          <div
            id="chart-month"
            role="group"
            aria-roledescription="gráfico"
            aria-label="Avaliações por mês"
            tabIndex={0}
            aria-describedby="chart-month-hint"
            className="chart-frame mt-4 h-[320px] w-full"
            hidden={monthEmpty}
          />
          <EmptyState align="start" className="mt-4" hidden={!monthEmpty} />
          <p id="chart-month-hint" className="sr-only">
            Use as setas para percorrer os meses (PageUp/PageDown para avançar ou voltar 12 meses). Enter ou Espaço filtra o mês destacado. Escape
            remove o filtro de mês. Uma tabela com os mesmos dados segue logo abaixo.
          </p>
          <p id="chart-month-live" className="sr-only" aria-live="polite" />
          {effectiveChartsData !== undefined && !monthEmpty ? <MonthTable months={effectiveChartsData.months} /> : null}
        </article>

        <article className="card">
          <h2 className="title">Volume por jogo</h2>
          <p className="meta mt-2">Jogos com mais avaliações</p>
          <ol
            id="rank-games"
            ref={gameRanksRef}
            className="rank-list"
            hidden={gamesEmpty}
          />
          <EmptyState align="start" className="mt-4" hidden={!gamesEmpty} />
          {gameRankNote ? (
            <p className="meta mt-4" hidden={gamesEmpty}>
              {gameRankNote}
            </p>
          ) : null}
        </article>

        <article className="card charts-col-span-2 card-playtime">
          <h2 className="title">Recomendação por tempo de jogo</h2>

          <div className="playtime-desktop">
            <p className="meta mt-2">
              Aprovação por faixa de horas jogadas (reembolso até 2{' '}h)
            </p>
            <div id="chart-playtime" className="chart-frame mt-4 h-[280px] w-full" hidden={playtimeEmpty} />
            <EmptyState align="start" className="mt-4" hidden={!playtimeEmpty} />
            {effectiveChartsData !== undefined && !playtimeEmpty ? (
              <PlaytimeLegend
                rows={effectiveChartsData.playtime}
                active={currentFilters.playtime}
                onToggle={togglePlaytime}
              />
            ) : null}
          </div>

          <div className="playtime-mobile">
            <p className="meta mt-2">
              Barras partem da base geral ({formatPercent(BASELINE_RATE)}) · janela de reembolso até 2&nbsp;h
            </p>
            <EmptyState align="start" className="mt-4" hidden={!playtimeEmpty} />
            {effectiveChartsData !== undefined && !playtimeEmpty ? (
              <PlaytimeRanks
                rows={effectiveChartsData.playtime}
                active={currentFilters.playtime}
                onToggle={togglePlaytime}
              />
            ) : null}
          </div>
        </article>

        <article className="card">
          <h2 className="title">Aprovação por idioma</h2>
          <p className="meta mt-2">
            Top idiomas por volume, ordenados pela aprovação · barras partem da base geral ({formatPercent(BASELINE_RATE)})
          </p>
          <ol
            id="rank-languages"
            ref={languageRanksRef}
            className="rank-list"
            hidden={languagesEmpty}
          />
          <EmptyState align="start" className="mt-4" hidden={!languagesEmpty} />
          {languageRankNote ? (
            <p className="meta mt-4" hidden={languagesEmpty}>
              {languageRankNote}
            </p>
          ) : null}
        </article>

        {error && effectiveChartsData !== undefined ? (
          <div
            className="charts-col-span-3 flex flex-wrap items-center gap-3"
            role="alert"
          >
            <p className="meta">Não foi possível atualizar os gráficos.</p>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => void refetch()}
            >
              Tentar de novo
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function ChartsIsland() {
  return (
    <QueryRoot>
      <ChartsContent />
    </QueryRoot>
  );
}
