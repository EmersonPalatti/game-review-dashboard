import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { fetchMetrics } from '../../lib/api';
import { useDelayedFlag } from '../../lib/fetchFeedback';
import {
  BASELINE_AUTHORS,
  BASELINE_GAMES,
  BASELINE_PERIOD_SHORT,
  BASELINE_RATE,
  BASELINE_REVIEWS,
  METRIC_CARDS_CONFIG,
  PLACEHOLDER,
  activePresetNote,
} from '../../lib/constants';
import { formatInteger, formatPercent } from '../../lib/format';
import { useFilters } from '../../lib/useNanostore';
import { activeFilterCount, type Filters } from '../../stores/filters';
import { latestMetrics } from '../../stores/metrics';
import { QueryRoot } from './QueryRoot';

function ease(amount: number): number {
  let t = amount;
  for (let step = 0; step < 6; step += 1) {
    const u = 1 - t;
    const x = 3 * u * u * t * 0.22 + 3 * u * t * t * 0.36 + t * t * t;
    const slope = 3 * u * u * 0.22 + 6 * u * t * (0.36 - 0.22) + 3 * t * t * (1 - 0.36);
    if (Math.abs(slope) < 1e-4) break;
    t = Math.min(1, Math.max(0, t - (x - amount) / slope));
  }
  const u = 1 - t;
  return 3 * u * u * t * 1 + 3 * u * t * t * 1 + t * t * t;
}

const ppFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

function AnimatedFigure({
  id,
  accent,
  value,
  format,
}: {
  id: string;
  accent?: boolean;
  value: number | undefined;
  format: (n: number) => string;
}) {
  const elementRef = useRef<HTMLParagraphElement>(null);
  const storedValueRef = useRef<number | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    if (value === undefined) {
      element.textContent = PLACEHOLDER;
      return;
    }

    const from = storedValueRef.current;
    storedValueRef.current = value;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (from === null || reduced || from === value) {
      element.textContent = format(value);
      return;
    }

    const start = performance.now();
    let frameId = 0;
    const tick = (now: number) => {
      if (storedValueRef.current !== value) return;
      const amount = Math.min(1, (now - start) / 360);
      const interpolated = amount === 1 ? value : from + (value - from) * ease(amount);
      element.textContent = format(interpolated);
      if (amount < 1) frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, format]);

  return (
    <p
      ref={elementRef}
      id={`metric-${id}`}
      className={accent ? 'figure is-accent' : 'figure'}
    >
      {PLACEHOLDER}
    </p>
  );
}

function MetricCardBody({
  id,
  label,
  sublabel,
  accent,
  value,
  format,
}: {
  id: string;
  label: string;
  sublabel: string;
  accent?: boolean;
  value: number | undefined;
  format: (n: number) => string;
}) {
  const figure = (
    <AnimatedFigure id={id} accent={accent} value={value} format={format} />
  );

  return (
    <article className="card flex flex-col gap-3">
      <p className="meta">{label}</p>
      {accent ? (
        <div className="relative">
          {figure}
          <span className="stamp-rule" aria-hidden="true" />
        </div>
      ) : (
        figure
      )}
      <p id={`metric-${id}-sub`} className="meta">
        {sublabel}
      </p>
    </article>
  );
}

function MetricsContent() {
  const currentFilters = useFilters();
  const queryKey = useMemo(() => ['metrics', currentFilters] as const, [currentFilters]);

  const baselineReviews = useRef(BASELINE_REVIEWS);
  const baselineRate = useRef(BASELINE_RATE);
  const baselineGames = useRef(BASELINE_GAMES);
  const baselineAuthors = useRef(BASELINE_AUTHORS);

  const { data, error, isPending, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchMetrics(currentFilters),
    placeholderData: keepPreviousData,
  });

  const showBusy = useDelayedFlag(isFetching);
  const showUpdating = useDelayedFlag(isPlaceholderData);

  useEffect(() => {
    if (data) latestMetrics.set(data);
  }, [data]);

  const metrics = data;
  if (metrics && !isPlaceholderData && activeFilterCount(currentFilters) === 0) {
    baselineReviews.current = metrics.total_reviews;
    baselineRate.current = metrics.recommendation_rate;
    baselineGames.current = metrics.game_count;
    baselineAuthors.current = metrics.author_count;
  }

  useEffect(() => {
    const subtitle = document.getElementById('context-subtitle');
    if (!subtitle) return;

    if (showUpdating) {
      subtitle.textContent = 'Atualizando…';
      return;
    }

    if (isPlaceholderData) return;

    if (!data) return;

    const presetNote = activePresetNote(currentFilters);
    subtitle.textContent = presetNote
      ? `${formatInteger(data.total_reviews)} avaliações · ${formatInteger(data.game_count)} jogos · ${presetNote}`
      : `${formatInteger(data.total_reviews)} avaliações · ${formatInteger(data.game_count)} jogos · ${BASELINE_PERIOD_SHORT}`;
  }, [data, currentFilters, isPlaceholderData, showUpdating]);

  const filtered = activeFilterCount(currentFilters) > 0;

  const sublabels: Record<string, string> = useMemo(() => {
    if (!metrics) {
      return Object.fromEntries(METRIC_CARDS_CONFIG.map((c) => [c.id, c.defaultSub]));
    }

    const reviewsSub = !filtered
      ? '100% da base\u00a0auditada'
      : `${formatPercent(baselineReviews.current > 0 ? metrics.total_reviews / baselineReviews.current : 0)} de\u00a0${formatInteger(baselineReviews.current)}`;

    let recommendationSub: string;
    if (!filtered) {
      recommendationSub = 'média global da\u00a0base';
    } else {
      const diffPp = (metrics.recommendation_rate - baselineRate.current) * 100;
      recommendationSub = `${ppFormat.format(diffPp)} p.p. vs. base\u00a0(${formatPercent(baselineRate.current)})`;
    }

    const gamesSub = !filtered
      ? 'no catálogo\u00a0analisado'
      : `de ${formatInteger(baselineGames.current)} no\u00a0catálogo`;

    const authorsSub = !filtered
      ? 'contas distintas na\u00a0base'
      : `${formatPercent(baselineAuthors.current > 0 ? metrics.author_count / baselineAuthors.current : 0)} de ${formatInteger(baselineAuthors.current)}\u00a0contas`;

    return {
      reviews: reviewsSub,
      recommendation: recommendationSub,
      games: gamesSub,
      authors: authorsSub,
    };
  }, [metrics, filtered, currentFilters]);

  const formatters: Record<string, (n: number) => string> = useMemo(
    () => ({
      reviews: formatInteger,
      recommendation: formatPercent,
      games: formatInteger,
      authors: formatInteger,
    }),
    [],
  );

  const values: Record<string, number | undefined> = useMemo(
    () =>
      metrics
        ? {
            reviews: metrics.total_reviews,
            recommendation: metrics.recommendation_rate,
            games: metrics.game_count,
            authors: metrics.author_count,
          }
        : {
            reviews: undefined,
            recommendation: undefined,
            games: undefined,
            authors: undefined,
          },
    [metrics],
  );

  let errorBlock: ReactNode = null;
  if (error && metrics !== undefined) {
    errorBlock = (
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 xl:col-span-4" role="alert">
        <p className="meta">Não foi possível atualizar os indicadores (verifique a API em 127.0.0.1:8000).</p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      aria-label="Indicadores"
      data-fetching={showBusy ? 'true' : 'false'}
      aria-busy={showBusy}
    >
      {errorBlock}
      {METRIC_CARDS_CONFIG.map((card) => (
        <MetricCardBody
          key={card.id}
          id={card.id}
          label={card.label}
          sublabel={sublabels[card.id] ?? card.defaultSub}
          accent={card.accent}
          value={isPending && !metrics ? undefined : values[card.id]}
          format={formatters[card.id] ?? formatInteger}
        />
      ))}
    </section>
  );
}

export function MetricsIsland() {
  return (
    <QueryRoot>
      <MetricsContent />
    </QueryRoot>
  );
}
