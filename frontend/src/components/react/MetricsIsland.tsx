import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { fetchMetrics, type Metrics } from '../../lib/api';
import { useDelayedFlag } from '../../lib/fetchFeedback';
import {
  BASELINE_AUTHORS,
  BASELINE_GAMES,
  BASELINE_RATE,
  BASELINE_REVIEWS,
  METRIC_CARDS_CONFIG,
  PLACEHOLDER,
} from '../../lib/constants';
import { formatInteger, formatPercent } from '../../lib/format';
import { serverFilters, useFilters } from '../../lib/useNanostore';
import { useHydrated } from '../../lib/useHydrated';
import { activeFilterCount, type Filters, type Tri } from '../../stores/filters';
import { latestMetrics } from '../../stores/metrics';
import { QueryRoot } from './QueryRoot';

/** Último resultado definitivo e os filtros que o produziram. */
type SettledMetrics = {
  metrics: Metrics;
  filters: Filters;
};

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

/** Mesmo texto da barra lateral: o rótulo do grupo e o da opção escolhida. */
const RECOMMENDED_FILTER_LABEL: Record<Tri, string> = {
  all: 'Recomendação: Todas',
  yes: 'Recomendação: Sim',
  no: 'Recomendação: Não',
};

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
      // Sem valor não há origem para contar: o próximo número aparece direto, sem animar a partir do travessão.
      storedValueRef.current = null;
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
    <>
      {/* A contagem animada é decorativa; leitores de tela recebem o valor final no sr-only. */}
      <p
        ref={elementRef}
        id={`metric-${id}`}
        className={accent ? 'figure metric-figure is-accent' : 'figure metric-figure'}
        aria-hidden="true"
      >
        {PLACEHOLDER}
      </p>
      <span className="sr-only">{value === undefined ? PLACEHOLDER : format(value)}</span>
    </>
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
    <article className="card metric-card flex flex-col gap-3">
      <p className="meta">{label}</p>
      {accent ? (
        <div className="relative">
          {figure}
          <span className="stamp-rule" aria-hidden="true" />
        </div>
      ) : (
        figure
      )}
      <p id={`metric-${id}-sub`} className="meta metric-sub">
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

  const { data, error, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey,
    queryFn: () => fetchMetrics(currentFilters),
    placeholderData: keepPreviousData,
  });

  // Com filtro de recomendação, a taxa do recorte filtrado é 0% ou 100% por definição.
  // O cartão mostra a taxa do mesmo recorte sem esse filtro, buscada à parte.
  // Sem o filtro a busca fica desligada e a chave coincide com a do cartão geral, então o cache é compartilhado.
  const recommendationActive = currentFilters.recommended !== 'all';
  const recommendedLabel = RECOMMENDED_FILTER_LABEL[currentFilters.recommended];
  const baseFilters = useMemo<Filters>(
    () => ({ ...currentFilters, recommended: 'all' }),
    [currentFilters],
  );
  const baseQuery = useQuery({
    queryKey: ['metrics', baseFilters] as const,
    queryFn: () => fetchMetrics(baseFilters),
    enabled: recommendationActive,
    placeholderData: keepPreviousData,
  });

  const mounted = useHydrated();

  const showBusyFlag = useDelayedFlag(isFetching || baseQuery.isFetching);
  const recommendationPending =
    recommendationActive && (baseQuery.isPlaceholderData || baseQuery.isError);
  const showUpdating = useDelayedFlag(isPlaceholderData || recommendationPending);

  useEffect(() => {
    if (data) latestMetrics.set(data);
  }, [data]);

  // Enquanto um recorte novo carrega, `data` ainda é o anterior (keepPreviousData).
  // Os subtítulos e a legenda precisam descrever os filtros que produziram esses números,
  // por isso guardamos o último resultado definitivo junto com seus filtros.
  const settledRef = useRef<SettledMetrics | null>(null);
  if (data && !isPlaceholderData) {
    settledRef.current = { metrics: data, filters: currentFilters };
  }
  const settled = settledRef.current;

  // Mesmo critério para a taxa base: guarda o último resultado definitivo junto com o recorte que o produziu.
  const baseSettledRef = useRef<SettledMetrics | null>(null);
  if (baseQuery.data && !baseQuery.isPlaceholderData) {
    baseSettledRef.current = { metrics: baseQuery.data, filters: baseFilters };
  }
  const baseSettled = baseSettledRef.current;

  // Se a busca do recorte novo falhar sem dados, os números exibidos são os do último recorte carregado.
  // Durante o primeiro render (SSR e hidratação do cliente), renderiza os valores de carregamento
  // estritamente idênticos ao SSR, atualizando em seguida no efeito para evitar falha de hidratação.
  const rawMetrics: Metrics | undefined = data ?? settled?.metrics;
  const metrics: Metrics | undefined = mounted ? rawMetrics : undefined;
  const shownFilters: Filters = mounted ? (settled?.filters ?? currentFilters) : serverFilters;
  const shownFiltered = mounted && activeFilterCount(shownFilters) > 0;
  const numbersStale = mounted && (showUpdating || (data === undefined && rawMetrics !== undefined));
  const showBusy = mounted && showBusyFlag;

  if (data && !isPlaceholderData && activeFilterCount(currentFilters) === 0) {
    baselineReviews.current = data.total_reviews;
    baselineRate.current = data.recommendation_rate;
    baselineGames.current = data.game_count;
    baselineAuthors.current = data.author_count;
  }


  const sublabels: Record<string, string> = useMemo(() => {
    if (!metrics) {
      return Object.fromEntries(METRIC_CARDS_CONFIG.map((c) => [c.id, 'Carregando…']));
    }

    const empty = metrics.total_reviews === 0;

    let reviewsSub: string;
    if (empty) {
      reviewsSub = 'nenhuma avaliação neste recorte';
    } else if (!shownFiltered) {
      reviewsSub = '100% da base auditada';
    } else {
      reviewsSub = `${formatPercent(baselineReviews.current > 0 ? metrics.total_reviews / baselineReviews.current : 0)} de ${formatInteger(baselineReviews.current)}`;
    }

    let recommendationSub: string;
    if (empty) {
      recommendationSub = 'sem avaliações neste recorte';
    } else if (recommendationActive) {
      if (!baseSettled) {
        recommendationSub = baseQuery.isError ? 'não foi possível carregar a taxa' : 'Carregando…';
      } else if (activeFilterCount(baseSettled.filters) === 0) {
        recommendationSub = `antes do filtro “${recommendedLabel}” · média global da base`;
      } else {
        const diffPp = (baseSettled.metrics.recommendation_rate - baselineRate.current) * 100;
        recommendationSub = `antes do filtro “${recommendedLabel}” · ${ppFormat.format(diffPp)} p.p. vs. base (${formatPercent(baselineRate.current)})`;
      }
    } else if (!shownFiltered) {
      recommendationSub = 'média global da base';
    } else {
      const diffPp = (metrics.recommendation_rate - baselineRate.current) * 100;
      recommendationSub = `${ppFormat.format(diffPp)} p.p. vs. base (${formatPercent(baselineRate.current)})`;
    }

    let gamesSub: string;
    if (empty) {
      gamesSub = 'nenhum jogo neste recorte';
    } else if (!shownFiltered) {
      gamesSub = 'no catálogo analisado';
    } else {
      gamesSub = `de ${formatInteger(baselineGames.current)} no catálogo`;
    }

    let authorsSub: string;
    if (empty) {
      authorsSub = 'nenhuma conta neste recorte';
    } else if (!shownFiltered) {
      authorsSub = 'contas distintas na base';
    } else {
      authorsSub = `${formatPercent(baselineAuthors.current > 0 ? metrics.author_count / baselineAuthors.current : 0)} de ${formatInteger(baselineAuthors.current)} contas`;
    }

    return {
      reviews: reviewsSub,
      recommendation: recommendationSub,
      games: gamesSub,
      authors: authorsSub,
    };
  }, [metrics, shownFiltered, recommendationActive, recommendedLabel, baseSettled, baseQuery.isError]);

  const formatters: Record<string, (n: number) => string> = useMemo(
    () => ({
      reviews: formatInteger,
      recommendation: formatPercent,
      games: formatInteger,
      authors: formatInteger,
    }),
    [],
  );

  const values: Record<string, number | undefined> = useMemo(() => {
    if (!metrics) {
      return {
        reviews: undefined,
        recommendation: undefined,
        games: undefined,
        authors: undefined,
      };
    }
    // Com filtro de recomendação, a taxa vem do recorte sem esse filtro (`baseSettled`).
    const rateMetrics = recommendationActive ? baseSettled?.metrics : metrics;
    // Sem avaliações não existe taxa: o cartão mostra o travessão, sem contagem.
    // Antes da primeira resposta da taxa base, o travessão também aparece, sem 0% nem 100%.
    const hasRate = metrics.total_reviews > 0 && rateMetrics !== undefined && rateMetrics.total_reviews > 0;
    return {
      reviews: metrics.total_reviews,
      recommendation: hasRate ? rateMetrics.recommendation_rate : undefined,
      games: metrics.game_count,
      authors: metrics.author_count,
    };
  }, [metrics, recommendationActive, baseSettled]);

  // Texto único e estável para leitores de tela. Enquanto a busca está pendente, `metrics`
  // é o recorte anterior, então o texto não muda e nada é anunciado de novo.
  const liveSummary = useMemo(() => {
    if (!metrics) return '';
    const parts = METRIC_CARDS_CONFIG.map((card) => {
      const value = values[card.id];
      let text: string;
      if (value === undefined) {
        text = metrics.total_reviews === 0 ? 'sem avaliações neste recorte' : 'carregando';
      } else if (card.id === 'recommendation' && recommendationActive) {
        text = `${formatPercent(value)}, antes do filtro “${recommendedLabel}”`;
      } else {
        text = (formatters[card.id] ?? formatInteger)(value);
      }
      return `${card.label} ${text}`;
    });
    return `${parts.join('; ')}.`;
  }, [metrics, values, formatters, recommendationActive, recommendedLabel]);

  let errorBlock: ReactNode = null;
  if (error && metrics !== undefined) {
    errorBlock = (
      <div className="flex flex-wrap items-center gap-3 col-span-2 xl:col-span-4" role="alert">
        <p className="meta">
          Não foi possível atualizar os indicadores. Os números abaixo são do último recorte carregado.
        </p>
        <button type="button" className="btn btn-secondary btn-small" onClick={() => void refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  return (
    <section
      className="grid grid-cols-2 gap-4 xl:grid-cols-4"
      aria-label="Indicadores"
      data-fetching={showBusy ? 'true' : 'false'}
      data-stale={numbersStale ? 'true' : 'false'}
      aria-busy={showBusy}
    >
      {errorBlock}
      {METRIC_CARDS_CONFIG.map((card) => (
        <MetricCardBody
          key={card.id}
          id={card.id}
          label={card.label}
          sublabel={sublabels[card.id] ?? (metrics ? card.defaultSub : 'Carregando…')}
          accent={card.accent}
          value={values[card.id]}
          format={formatters[card.id] ?? formatInteger}
        />
      ))}
      <p className="sr-only" aria-live="polite">
        {liveSummary}
      </p>
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
