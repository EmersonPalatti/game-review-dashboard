import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { flexRender } from '@tanstack/react-table/flex-render';
import {
  getCoreRowModel,
  legacyCreateColumnHelper,
  useLegacyTable,
} from '@tanstack/react-table/legacy';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { fetchReviewWindow, type ReviewItem } from '../../lib/api';
import { useDelayedFlag } from '../../lib/fetchFeedback';
import { PLACEHOLDER } from '../../lib/constants';
import { formatDate, formatHours, formatInteger, languageLabel } from '../../lib/format';
import { useFilters, useReviewSort } from '../../lib/useNanostore';
import {
  DEFAULT_SORT,
  resetFilters,
  reviewSort,
  type ReviewSort,
  type ReviewSortBy,
} from '../../stores/filters';
import { QueryRoot } from './QueryRoot';

const columnHelper = legacyCreateColumnHelper<ReviewItem>();

function SortChevronIcon() {
  return (
    <svg
      className="th-sort-icon"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path className="sort-up" d="m3.5 4.5 2.5-2.5 2.5 2.5" />
      <path className="sort-down" d="m3.5 7.5 2.5 2.5 2.5-2.5" />
    </svg>
  );
}

function cycleSort(key: ReviewSortBy): void {
  const current = reviewSort.get();
  if (current.sortBy !== key) {
    reviewSort.set({ sortBy: key, sortDir: 'desc' });
  } else if (current.sortDir === 'desc') {
    reviewSort.set({ sortBy: key, sortDir: 'asc' });
  } else if (key === 'created_at') {
    reviewSort.set({ sortBy: 'created_at', sortDir: 'desc' });
  } else {
    reviewSort.set({ ...DEFAULT_SORT });
  }
}

function RecommendationCell({ recommended }: { recommended: boolean }) {
  if (recommended) {
    return (
      <span className="sim">
        <span className="sim-rule" aria-hidden="true" />
        Sim
      </span>
    );
  }
  return <span className="nao">Não</span>;
}

function ReviewBadges({
  item,
  isExpanded,
  isTruncated,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  isTruncated: boolean;
}) {
  let secondaryCount = 0;
  if (item.received_for_free) secondaryCount++;
  if (!item.steam_purchase) secondaryCount++;
  if (item.votes_funny > 0) secondaryCount++;
  if (item.comment_count > 0) secondaryCount++;

  if (!isExpanded) {
    return (
      <div className="review-badges">
        <span className="review-badge">{formatDate(item.created_at)}</span>
        {item.early_access ? (
          <span className="review-badge is-accent">Acesso antecipado</span>
        ) : null}
        {secondaryCount > 0 ? (
          <span
            className="review-badge"
            title="Clique na linha para expandir mais detalhes"
          >
            +{secondaryCount} {secondaryCount === 1 ? 'detalhe' : 'detalhes'}
          </span>
        ) : null}
        {isTruncated ? (
          <span
            className="review-badge"
            title="Resumo limitado a 280 caracteres na higienização da base"
          >
            280 car.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="review-badges">
      <span className="review-badge">{formatDate(item.created_at)}</span>
      {item.early_access ? (
        <span className="review-badge is-accent">Acesso antecipado</span>
      ) : null}
      {item.received_for_free ? (
        <span className="review-badge">Recebido de graça</span>
      ) : null}
      {!item.steam_purchase ? <span className="review-badge">Chave externa</span> : null}
      {item.votes_funny > 0 ? (
        <span className="review-badge">{formatInteger(item.votes_funny)} engraçados</span>
      ) : null}
      {item.comment_count > 0 ? (
        <span className="review-badge">{formatInteger(item.comment_count)} coment.</span>
      ) : null}
      {isTruncated ? (
        <span
          className="review-badge"
          title="Resumo limitado a 280 caracteres na higienização da base"
        >
          Truncado em 280 caracteres
        </span>
      ) : null}
    </div>
  );
}

function ExcerptCell({
  item,
  isExpanded,
  onToggle,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const isTruncated = (item.excerpt?.length ?? 0) >= 275;

  return (
    <div className="excerpt-cell">
      <div className="excerpt-line">
        <button
          type="button"
          className="excerpt-toggle inline-flex items-center justify-center p-0 m-0 border-0 bg-transparent text-inherit cursor-pointer flex-none"
          aria-expanded={isExpanded}
          aria-label={
            isExpanded
              ? 'Recolher detalhes da avaliação'
              : 'Expandir detalhes da avaliação'
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          <svg
            className="excerpt-chevron"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <div className="excerpt-text">{item.excerpt || 'Sem texto na avaliação.'}</div>
      </div>
      <ReviewBadges item={item} isExpanded={isExpanded} isTruncated={isTruncated} />
    </div>
  );
}

function sortHeaderAria(sortKey: ReviewSortBy, currentSort: ReviewSort): 'ascending' | 'descending' | 'none' {
  if (currentSort.sortBy !== sortKey) return 'none';
  return currentSort.sortDir === 'asc' ? 'ascending' : 'descending';
}

function SortHeaderButton({
  label,
  sortKey,
  title,
  currentSort,
}: {
  label: ReactNode;
  sortKey: ReviewSortBy;
  title: string;
  currentSort: ReviewSort;
}) {
  const active = currentSort.sortBy === sortKey;
  return (
    <button
      type="button"
      className={active ? 'th-sort is-active' : 'th-sort'}
      data-sort-by={sortKey}
      data-sort-dir={active ? currentSort.sortDir : undefined}
      title={title}
      onClick={() => cycleSort(sortKey)}
    >
      <span>{label}</span>
      <SortChevronIcon />
    </button>
  );
}

function ReviewsTableContent() {
  const currentFilters = useFilters();
  const currentSort = useReviewSort();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const queryKey = useMemo(
    () => ['reviews', currentFilters, currentSort] as const,
    [currentFilters, currentSort],
  );

  const {
    data,
    error,
    isPending,
    isFetching,
    isFetchingNextPage,
    isPlaceholderData,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchReviewWindow(currentFilters, pageParam, currentSort),
    initialPageParam: 0,
    getNextPageParam: (last) => {
      const next = last.offset + last.items.length;
      return next < last.total ? next : undefined;
    },
    placeholderData: keepPreviousData,
  });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  const total = data?.pages.at(-1)?.total ?? data?.pages[0]?.total ?? 0;

  const cutRefetchActive =
    items.length > 0 && !isFetchingNextPage && (isPlaceholderData || isFetching);
  const showBusy = useDelayedFlag(isFetching && !isFetchingNextPage);
  const showUpdating = useDelayedFlag(cutRefetchActive);

  useEffect(() => {
    setExpanded(new Set());
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [queryKey]);

  const tryFetchNext = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < 240) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => tryFetchNext();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [tryFetchNext]);

  useEffect(() => {
    if (!isPending) tryFetchNext();
  }, [items.length, isPending, tryFetchNext]);

  const toggleExpanded = useCallback((reviewId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  }, []);

  const columns = useMemo(
    () => [
      columnHelper.accessor('app_name', {
        id: 'game',
        header: 'Jogo',
        meta: { thClass: 'w-[16%]' },
        cell: (info) => (
          <span title={info.getValue()}>{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor('language', {
        id: 'language',
        header: 'Idioma',
        meta: { thClass: 'w-[12%]' },
        cell: (info) => {
          const label = languageLabel(info.getValue());
          return <span title={label}>{label}</span>;
        },
      }),
      columnHelper.accessor('recommended', {
        id: 'recommendation',
        header: 'Recomendação',
        meta: { thClass: 'w-[10%]' },
        cell: (info) => <RecommendationCell recommended={info.getValue()} />,
      }),
      columnHelper.accessor('playtime_at_review_hours', {
        id: 'playtime_hours',
        header: () => (
          <SortHeaderButton
            label="Horas"
            sortKey="playtime_hours"
            title="Ordenar por horas jogadas"
            currentSort={currentSort}
          />
        ),
        meta: { thClass: 'w-[10%]', sortKey: 'playtime_hours' as ReviewSortBy },
        cell: (info) => {
          const hours = info.getValue();
          return hours === null || !Number.isFinite(hours) ? PLACEHOLDER : formatHours(hours);
        },
      }),
      columnHelper.accessor('votes_helpful', {
        id: 'votes_helpful',
        header: () => (
          <SortHeaderButton
            label={<>Votos{'\u00a0'}úteis</>}
            sortKey="votes_helpful"
            title="Ordenar por votos úteis"
            currentSort={currentSort}
          />
        ),
        meta: { thClass: 'w-[11%]', sortKey: 'votes_helpful' as ReviewSortBy },
        cell: (info) => formatInteger(info.getValue()),
      }),
      columnHelper.display({
        id: 'excerpt',
        header: () => (
          <div className="flex items-center justify-between gap-2">
            <span>Trecho</span>
            <SortHeaderButton
              label="Data"
              sortKey="created_at"
              title="Ordenar por data de publicação"
              currentSort={currentSort}
            />
          </div>
        ),
        meta: { thClass: 'w-[41%]', sortKey: 'created_at' as ReviewSortBy },
        cell: (info) => (
          <ExcerptCell
            item={info.row.original}
            isExpanded={expanded.has(info.row.original.review_id)}
            onToggle={() => toggleExpanded(info.row.original.review_id)}
          />
        ),
      }),
    ],
    [currentSort, expanded, toggleExpanded],
  );

  const table = useLegacyTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.review_id),
  });

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualRows = virtualizer.getVirtualItems();
  const paddingTop = virtualRows[0]?.start ?? 0;
  const paddingBottom = virtualizer.getTotalSize() - (virtualRows.at(-1)?.end ?? 0);

  const rows = table.getRowModel().rows;
  const showEmpty = !isPending && items.length === 0 && !error;

  let statusText: string;
  if (isPending && items.length === 0) {
    statusText = 'Carregando avaliações…';
  } else if (isFetchingNextPage) {
    statusText = `${formatInteger(items.length)} de ${formatInteger(total)} carregadas · carregando mais…`;
  } else if (showUpdating) {
    statusText = 'Atualizando…';
  } else if (total === 0) {
    statusText = '0 de 0';
  } else {
    statusText = `${formatInteger(items.length)} de ${formatInteger(total)} carregadas`;
  }

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="reviews-heading"
      data-fetch-region="reviews"
      data-fetching={showBusy ? 'true' : 'false'}
      aria-busy={showBusy}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="reviews-heading" className="title">
          Avaliações
        </h2>
        <p className="meta">Clique na linha ou pressione Enter no botão de detalhes para expandir</p>
      </div>

      <div className="sheet-card">
        <div
          ref={scrollRef}
          className="sheet sheet-virtual"
          tabIndex={0}
          role="region"
          aria-label="Tabela de avaliações"
          data-reviews-virtual="true"
        >
          <table>
            <caption className="sr-only">Avaliações da seleção atual</caption>
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as
                      | { thClass?: string; sortKey?: ReviewSortBy }
                      | undefined;
                    const sortKey = meta?.sortKey;
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        className={meta?.thClass}
                        aria-sort={sortKey ? sortHeaderAria(sortKey, currentSort) : undefined}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody id="reviews-body">
              {showEmpty ? (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    <div className="empty-state">
                      <p>Nenhuma avaliação com esses filtros.</p>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => resetFilters()}
                      >
                        Limpar filtros
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <>
                  {paddingTop > 0 ? (
                    <tr aria-hidden="true" className="sheet-spacer">
                      <td
                        colSpan={6}
                        style={{ height: paddingTop, padding: 0, border: 0 }}
                      />
                    </tr>
                  ) : null}
                  {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    if (!row) return null;
                    const reviewId = row.original.review_id;
                    const isExpanded = expanded.has(reviewId);
                    return (
                      <tr
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        className={isExpanded ? 'review-row is-expanded' : 'review-row'}
                        onClick={() => toggleExpanded(reviewId)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {paddingBottom > 0 ? (
                    <tr aria-hidden="true" className="sheet-spacer">
                      <td
                        colSpan={6}
                        style={{ height: paddingBottom, padding: 0, border: 0 }}
                      />
                    </tr>
                  ) : null}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {error && items.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3" role="alert">
          <p className="meta">Não foi possível carregar as avaliações.</p>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => void refetch()}
          >
            Tentar de novo
          </button>
        </div>
      ) : null}

      <p id="reviews-status" className="meta font-mono tabular-nums">
        {isFetchingNextPage ? (
          <>
            <span aria-hidden="true">
              {`${formatInteger(items.length)} de ${formatInteger(total)} carregadas · `}
            </span>
            <span aria-live="polite">carregando mais…</span>
          </>
        ) : (
          <span aria-live="polite" aria-atomic="true">
            {statusText}
          </span>
        )}
      </p>

      <p className="meta">
        Base higienizada: partição 1:1 das 4 tabelas do Kaggle · underflow uint32 corrigido em votos
        engraçados · resumo truncado em 280{'\u00a0'}caracteres.
      </p>
    </section>
  );
}

export function ReviewsIsland() {
  return (
    <QueryRoot>
      <ReviewsTableContent />
    </QueryRoot>
  );
}
