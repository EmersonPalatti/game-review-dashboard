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
import { PLACEHOLDER, REFUND_BUCKETS } from '../../lib/constants';
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

function renderLanguageRanks(
  container: HTMLOListElement,
  languages: LanguageBar[],
  currentLanguage: string | null,
): void {
  container.replaceChildren();
  const sorted = [...languages].sort(compareLanguagesByApproval);
  sorted.forEach((item, index) => {
    const selected = currentLanguage === item.language;
    const rate = item.recommendation_rate;
    const valueText =
      rate === null ? PLACEHOLDER : `${formatPercent(rate)} · ${formatInteger(item.review_count)}`;
    const name = languageLabel(item.language);
    container.append(
      rankRow(
        `lang:${item.language}`,
        index,
        name,
        valueText,
        rate === null ? 0 : rate * 100,
        {
          title: `${name}: ${formatCount(item.review_count, 'avaliação', 'avaliações')}`,
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
            title={`${row.label}: ${formatCount(row.review_count, 'avaliação', 'avaliações')}`}
            onClick={() => onToggle(bucket)}
          >
            {refund ? <span className="playtime-chip-dot" aria-hidden="true" /> : null}
            <span className="playtime-chip-label">{row.label}</span>
            <span className="playtime-chip-value">{rate}</span>
          </button>
        );
      })}
    </div>
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
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      aria-label="Gráficos"
      data-fetching={showBusy ? 'true' : 'false'}
      aria-busy={showBusy}
    >
      <article className="card lg:col-span-2">
        <h2 className="title">Avaliações por mês</h2>
        <p className="meta mt-2">Publicadas em cada mês do recorte · pico destacado</p>
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

      <article className="card lg:col-span-2">
        <h2 className="title">Recomendação por tempo de jogo</h2>
        <p className="meta mt-2">
          Aprovação por faixa (reembolso até 2{' '}h)
        </p>
        <div id="chart-playtime" className="mt-4 h-[280px] w-full" hidden={playtimeEmpty} />
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
      </article>

      <article className="card">
        <h2 className="title">Aprovação por idioma</h2>
        <p className="meta mt-2">Top idiomas por volume, ordenados pela aprovação</p>
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
          className="flex flex-wrap items-center gap-3 lg:col-span-3"
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
  );
}

export function ChartsIsland() {
  return (
    <QueryRoot>
      <ChartsContent />
    </QueryRoot>
  );
}
