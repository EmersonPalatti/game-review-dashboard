import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { fetchCharts, fetchMetrics, type GameBar, type LanguageBar } from '../../lib/api';
import { useDelayedFlag } from '../../lib/fetchFeedback';
import { PLACEHOLDER } from '../../lib/constants';
import { formatInteger, formatPercent, languageLabel } from '../../lib/format';
import { useFilters } from '../../lib/useNanostore';
import { disposeCharts, initCharts, renderCharts } from '../../scripts/charts';
import { rankRow } from '../../scripts/renderers';
import {
  filters,
  getActiveMonth,
  getMonthDateRange,
  type Filters,
} from '../../stores/filters';
import { QueryRoot } from './QueryRoot';

function patchFilters(patch: Partial<Filters>): void {
  filters.set({ ...filters.get(), ...patch });
}

function renderGameRanks(
  container: HTMLOListElement,
  games: GameBar[],
  appIdByName: Map<string, number>,
  currentAppId: number | null,
): void {
  container.replaceChildren();
  if (games.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'meta';
    empty.textContent = 'Nenhum jogo no recorte.';
    container.append(empty);
    return;
  }
  const max = Math.max(...games.map((game) => game.review_count), 1);
  games.forEach((game, index) => {
    const appId = appIdByName.get(game.app_name) ?? null;
    const selected = appId !== null && currentAppId === appId;
    container.append(
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

function renderLanguageRanks(
  container: HTMLOListElement,
  languages: LanguageBar[],
  currentLanguage: string | null,
): void {
  container.replaceChildren();
  if (languages.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'meta';
    empty.textContent = 'Nenhum idioma no recorte.';
    container.append(empty);
    return;
  }
  const sorted = [...languages].sort(
    (a, b) =>
      (b.recommendation_rate ?? -1) - (a.recommendation_rate ?? -1) ||
      b.review_count - a.review_count,
  );
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

function ChartsContent() {
  const currentFilters = useFilters();
  const metricsKey = useMemo(() => ['metrics', currentFilters] as const, [currentFilters]);
  const chartsKey = useMemo(() => ['charts', currentFilters] as const, [currentFilters]);

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

  const showBusy = useDelayedFlag(chartsFetching);
  const activeMonth = getActiveMonth(currentFilters.dateFrom, currentFilters.dateTo);

  useEffect(() => {
    initCharts(
      (bucket) => {
        const current = filters.get().playtime;
        patchFilters({ playtime: current === bucket ? 'all' : bucket });
      },
      (month) => {
        const current = filters.get();
        const currentMonth = getActiveMonth(current.dateFrom, current.dateTo);
        if (currentMonth === month) {
          patchFilters({ dateFrom: null, dateTo: null });
        } else {
          patchFilters(getMonthDateRange(month));
        }
      },
    );
    return () => {
      disposeCharts();
    };
  }, []);

  const dateFilterActive = currentFilters.dateFrom !== null || currentFilters.dateTo !== null;

  useEffect(() => {
    if (chartsData) {
      renderCharts(chartsData, currentFilters.playtime, activeMonth, dateFilterActive);
    }
  }, [chartsData, currentFilters.playtime, activeMonth, dateFilterActive]);

  useEffect(() => {
    const rankGames = document.getElementById('rank-games');
    const rankLanguages = document.getElementById('rank-languages');
    if (!(rankGames instanceof HTMLOListElement) || !(rankLanguages instanceof HTMLOListElement)) {
      return;
    }
    if (!chartsData) {
      rankGames.replaceChildren();
      rankLanguages.replaceChildren();
      return;
    }

    const appIdByName = new Map<string, number>();
    if (metricsData) {
      for (const game of metricsData.games) {
        appIdByName.set(game.app_name, game.app_id);
      }
    }

    renderGameRanks(rankGames, chartsData.games, appIdByName, currentFilters.appId);
    renderLanguageRanks(rankLanguages, chartsData.languages, currentFilters.language);
  }, [chartsData, metricsData, currentFilters.appId, currentFilters.language]);

  return (
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      aria-label="Gráficos"
      data-fetching={showBusy ? 'true' : 'false'}
      aria-busy={showBusy}
    >
      <article className="card lg:col-span-2">
        <h2 className="title">Avaliações por mês</h2>
        <p className="meta mt-2">
          Publicadas em cada mês do recorte · pico destacado · clique para{'\u00a0'}filtrar
        </p>
        <div id="chart-month" className="mt-4 h-[320px] w-full" />
        <p id="chart-month-empty" className="meta mt-4" hidden>
          Nenhum mês no recorte.
        </p>
      </article>

      <article className="card">
        <h2 className="title">Volume por jogo</h2>
        <p className="meta mt-2">
          Jogos com mais avaliações · clique para{'\u00a0'}filtrar
        </p>
        <ol id="rank-games" className="rank-list" />
      </article>

      <article className="card lg:col-span-2">
        <h2 className="title">Recomendação por tempo de jogo</h2>
        <p className="meta mt-2">
          Aprovação por faixa (reembolso até 2{'\u00a0'}h) · clique para{'\u00a0'}filtrar
        </p>
        <div id="chart-playtime" className="mt-4 h-[280px] w-full" />
        <p id="chart-playtime-empty" className="meta mt-4" hidden>
          Nenhuma faixa no recorte.
        </p>
      </article>

      <article className="card">
        <h2 className="title">Aprovação por idioma</h2>
        <p className="meta mt-2">
          Top idiomas por volume, ordenados pela aprovação · clique para{'\u00a0'}filtrar
        </p>
        <ol id="rank-languages" className="rank-list" />
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
