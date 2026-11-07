import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
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
import {
  disposeCharts,
  formatMonth,
  initCharts,
  renderCharts,
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

const EMPTY_TEXT = 'Sem avaliações neste recorte.';
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
  return (
    <div className="playtime-legend" role="group" aria-label="Filtrar por faixa de tempo de jogo">
      {rows.map((row) => {
        if (!isPlaytimeBucket(row.key)) return null;
        const bucket = row.key;
        const refund = REFUND_BUCKETS.includes(bucket);
        const rate =
          row.recommendation_rate === null
            ? PLACEHOLDER
            : formatPercent(row.recommendation_rate);
        const rateName = row.recommendation_rate === null ? 'sem dados' : rate;
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
              {row.label.replace(/\s*h$/, '')}
              <span className="playtime-chip-unit"> h</span>
            </span>
          </button>
        );
      })}
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
        </tr>
      </thead>
      <tbody>
        {months.map((point) => (
          <tr key={point.month}>
            <th scope="row">{formatMonth(point.month)}</th>
            <td>{formatInteger(point.review_count)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartsContent() {
  const currentFilters = useFilters();
  const metricsKey = useMemo(() => ['metrics', currentFilters] as const, [currentFilters]);
  const chartsKey = useMemo(() => ['charts', currentFilters] as const, [currentFilters]);
  const gameRanksRef = useRef<HTMLOListElement>(null);
  const languageRanksRef = useRef<HTMLOListElement>(null);

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

  const showBusy = useDelayedFlag(chartsFetching);
  const activeMonth = getActiveMonth(currentFilters.dateFrom, currentFilters.dateTo);
  const dateFilterActive = currentFilters.dateFrom !== null || currentFilters.dateTo !== null;

  // Empty states are derived here once; each card collapses its chart area and shows one line.
  const monthEmpty = chartsData !== undefined && chartsData.months.length === 0;
  const playtimeEmpty =
    chartsData !== undefined && !chartsData.playtime.some((point) => point.review_count > 0);
  const gamesEmpty =
    currentFilters.appId !== null && facetsData !== undefined
      ? !facetsData.games.some((point) => point.review_count > 0)
      : chartsData !== undefined && chartsData.games.length === 0;
  const languagesEmpty =
    chartsData !== undefined && !chartsData.languages.some((point) => point.review_count > 0);

  const gameRankNote = useMemo(() => {
    if (currentFilters.appId === null) return null;
    if (!facetsData) {
      return 'Filtro de jogo ativo · clique para voltar ao ranking completo';
    }
    const withReviews = facetsData.games
      .filter((game) => game.review_count > 0)
      .sort((a, b) => b.review_count - a.review_count);
    const total = withReviews.length;
    const index = withReviews.findIndex((game) => game.app_id === currentFilters.appId);
    if (index < 0) {
      // Jogo sem avaliações no recorte: não tem posição no ranking.
      return 'Jogo destacado sem avaliações neste recorte · clique nele para limpar';
    }
    return `${formatInteger(index + 1)}º de ${formatInteger(total)} em volume · clique no jogo destacado para limpar`;
  }, [currentFilters.appId, facetsData]);

  const languageRankNote = useMemo(() => {
    if (currentFilters.language === null) return null;
    if (!chartsData) {
      return 'Filtro de idioma ativo · clique para voltar ao ranking completo';
    }
    const withReviews = chartsData.languages
      .filter((lang) => lang.review_count > 0 && lang.recommendation_rate !== null)
      .sort(compareLanguagesByApproval);
    const total = withReviews.length;
    const index = withReviews.findIndex((lang) => lang.language === currentFilters.language);
    if (index < 0) {
      // Idioma sem avaliações no recorte: não tem posição no ranking.
      return 'Idioma destacado sem avaliações neste recorte · clique nele para limpar';
    }
    return `${formatInteger(index + 1)}º de ${formatInteger(total)} em aprovação · clique no idioma destacado para limpar`;
  }, [currentFilters.language, chartsData]);

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
        className="charts-grid"
        aria-label="Gráficos"
        data-fetching={showBusy ? 'true' : 'false'}
        aria-busy={showBusy}
      >
        <article className="card charts-col-span-2">
          <h2 className="title">Avaliações por mês</h2>
          <p className="meta mt-2">Publicadas em cada mês do recorte · clique em um mês para filtrar</p>
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
          <p className="meta mt-4" hidden={!monthEmpty}>
            {EMPTY_TEXT}
          </p>
          <p id="chart-month-hint" className="sr-only">
            Use as setas para percorrer os meses (PageUp/PageDown para avançar ou voltar 12 meses). Enter ou Espaço filtra o mês destacado. Escape
            remove o filtro de mês.
          </p>
          <p id="chart-month-live" className="sr-only" aria-live="polite" />
          {chartsData !== undefined && !monthEmpty ? <MonthTable months={chartsData.months} /> : null}
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
          <p className="meta mt-4" hidden={!gamesEmpty}>
            {EMPTY_TEXT}
          </p>
          {gameRankNote ? (
            <p className="meta mt-4" hidden={gamesEmpty}>
              {gameRankNote}
            </p>
          ) : null}
        </article>

        <article className="card charts-col-span-2">
          <h2 className="title">Recomendação por tempo de jogo</h2>

          <div className="playtime-desktop">
            <p className="meta mt-2">
              Aprovação por faixa de horas jogadas (reembolso até 2{' '}h)
            </p>
            <div id="chart-playtime" className="chart-frame mt-4 h-[280px] w-full" hidden={playtimeEmpty} />
            <p className="meta mt-4" hidden={!playtimeEmpty}>
              {EMPTY_TEXT}
            </p>
            {chartsData !== undefined && !playtimeEmpty ? (
              <PlaytimeLegend
                rows={chartsData.playtime}
                active={currentFilters.playtime}
                onToggle={togglePlaytime}
              />
            ) : null}
          </div>

          <div className="playtime-mobile">
            <p className="meta mt-2">
              Barras partem da base geral ({formatPercent(BASELINE_RATE)}) · janela de reembolso até 2&nbsp;h
            </p>
            <p className="meta mt-4" hidden={!playtimeEmpty}>
              {EMPTY_TEXT}
            </p>
            {chartsData !== undefined && !playtimeEmpty ? (
              <PlaytimeRanks
                rows={chartsData.playtime}
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
          <p className="meta mt-4" hidden={!languagesEmpty}>
            {EMPTY_TEXT}
          </p>
          {languageRankNote ? (
            <p className="meta mt-4" hidden={languagesEmpty}>
              {languageRankNote}
            </p>
          ) : null}
        </article>

        {error && chartsData !== undefined ? (
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
