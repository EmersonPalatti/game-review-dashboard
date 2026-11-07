import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { flexRender } from '@tanstack/react-table/flex-render';
import {
  getCoreRowModel,
  legacyCreateColumnHelper,
  useLegacyTable,
  type LegacyColumnDef,
} from '@tanstack/react-table/legacy';
import type { RowData, TableFeatures } from '@tanstack/table-core';
import { useVirtualizer, useWindowVirtualizer } from '@tanstack/react-virtual';

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

// Estado de expansão vai pelo meta da tabela, para as colunas não serem recriadas a cada clique.
declare module '@tanstack/table-core' {
  interface TableMeta<TFeatures extends TableFeatures, TData extends RowData> {
    expanded?: Set<number>;
    toggleExpanded?: (reviewId: number) => void;
  }
}

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
  } else {
    reviewSort.set({ ...DEFAULT_SORT });
  }
}


function RecommendationIcon({ recommended }: { recommended: boolean }) {
  return (
    <svg
      className="rec-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {recommended ? <path d="M20 6 9 17l-5-5" /> : <path d="M5 12h14" />}
    </svg>
  );
}

function RecommendationCell({ recommended }: { recommended: boolean }) {
  return (
    <span className={recommended ? 'rec-cell is-yes' : 'rec-cell is-no'}>
      <RecommendationIcon recommended={recommended} />
      {recommended ? 'Sim' : 'Não'}
    </span>
  );
}

function ReviewBadges({
  item,
  isExpanded,
  isTruncated,
  id,
}: {
  item: ReviewItem;
  isExpanded: boolean;
  isTruncated: boolean;
  id?: string;
}) {
  let secondaryCount = 0;
  if (item.received_for_free) secondaryCount++;
  if (!item.steam_purchase) secondaryCount++;
  if (item.votes_funny > 0) secondaryCount++;
  if (item.comment_count > 0) secondaryCount++;

  if (!isExpanded) {
    return (
      <div id={id} className="review-badges">
        <span className="review-badge review-badge-date">{formatDate(item.created_at)}</span>
        {item.early_access ? (
          <span className="review-badge is-accent">Acesso antecipado</span>
        ) : null}
        {secondaryCount > 0 ? (
          <span
            className="review-badge"
            title="Clique para ver os detalhes"
          >
            +{secondaryCount} {secondaryCount === 1 ? 'detalhe' : 'detalhes'}
          </span>
        ) : null}
        {isTruncated ? (
          <span
            className="review-badge"
            title="Resumo limitado a 280 caracteres na higienização da base"
          >
            truncado
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div id={id} className="review-badges">
      <span className="review-badge review-badge-date">{formatDate(item.created_at)}</span>
      {item.early_access ? (
        <span className="review-badge is-accent">Acesso antecipado</span>
      ) : null}
      {item.received_for_free ? (
        <span className="review-badge is-detail review-badge-detail">Recebido de graça</span>
      ) : null}
      {!item.steam_purchase ? (
        <span className="review-badge is-detail review-badge-detail">Chave externa</span>
      ) : null}
      {item.votes_funny > 0 ? (
        <span className="review-badge is-detail review-badge-detail">
          {formatInteger(item.votes_funny)} engraçados
        </span>
      ) : null}
      {item.comment_count > 0 ? (
        <span className="review-badge is-detail review-badge-detail">
          {formatInteger(item.comment_count)} coment.
        </span>
      ) : null}
      {isTruncated ? (
        <span
          className="review-badge is-detail review-badge-detail"
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
  const contentId = `review-details-${item.review_id}`;
  const excerptId = `review-excerpt-${item.review_id}`;

  return (
    <div className="excerpt-cell">
      <div className="excerpt-line">
        <button
          type="button"
          tabIndex={-1}
          className="excerpt-toggle"
          aria-expanded={isExpanded}
          aria-controls={contentId}
          aria-label={
            isExpanded
              ? 'Ocultar detalhes da avaliação'
              : 'Mostrar detalhes da avaliação'
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
        <div id={excerptId} className="excerpt-text">{item.excerpt || 'Sem texto na avaliação.'}</div>
      </div>
      <ReviewBadges
        id={contentId}
        item={item}
        isExpanded={isExpanded}
        isTruncated={isTruncated}
      />
    </div>
  );
}

function sortHeaderAria(sortKey: ReviewSortBy, currentSort: ReviewSort): 'ascending' | 'descending' | 'none' {
  if (currentSort.sortBy !== sortKey) return 'none';
  return currentSort.sortDir === 'asc' ? 'ascending' : 'descending';
}

const SORT_COLUMN_LABELS: Record<ReviewSortBy, string> = {
  created_at: 'data',
  votes_helpful: 'votos úteis',
  playtime_hours: 'horas jogadas',
};

function getNextSortDescription(sortKey: ReviewSortBy, currentSort: ReviewSort): string {
  const columnName = SORT_COLUMN_LABELS[sortKey];
  if (currentSort.sortBy !== sortKey) {
    return `Ordenar por ${columnName}, decrescente`;
  }
  if (currentSort.sortDir === 'desc') {
    return `Ordenar por ${columnName}, crescente`;
  }
  if (sortKey === DEFAULT_SORT.sortBy) {
    return `Ordenar por ${columnName}, decrescente`;
  }
  return 'Retornar à ordenação padrão (votos úteis, decrescente)';
}

function SortHeaderButton({
  label,
  sortKey,
  title,
  currentSort,
}: {
  label: ReactNode;
  sortKey: ReviewSortBy;
  title?: string;
  currentSort: ReviewSort;
}) {
  const active = currentSort.sortBy === sortKey;
  const nextSortText = title ?? getNextSortDescription(sortKey, currentSort);
  return (
    <button
      type="button"
      className={active ? 'th-sort is-active' : 'th-sort'}
      data-sort-by={sortKey}
      data-sort-dir={active ? currentSort.sortDir : undefined}
      title={nextSortText}
      aria-label={nextSortText}
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
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;
  const shouldFocusRef = useRef(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  });
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const updateScrollMargin = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = rect.top + window.scrollY;
    setScrollMargin(offset);
  }, []);

  // O que fica acima da tabela muda de altura (gráficos hidratando, achados recolhendo):
  // observar o body mantém o deslocamento da lista certo no scroll da janela.
  useEffect(() => {
    if (!isMobile) return;
    updateScrollMargin();
    const observer = new ResizeObserver(() => updateScrollMargin());
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [isMobile, updateScrollMargin]);

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

  // Offset pages can repeat a review when the source shifts between requests;
  // keep the first occurrence so each row has one stable React key.
  const items = useMemo(() => {
    const seen = new Set<number>();
    const unique: ReviewItem[] = [];
    for (const page of data?.pages ?? []) {
      for (const item of page.items) {
        if (seen.has(item.review_id)) continue;
        seen.add(item.review_id);
        unique.push(item);
      }
    }
    return unique;
  }, [data]);
  const total = data?.pages.at(-1)?.total ?? data?.pages[0]?.total ?? 0;

  const cutRefetchActive =
    items.length > 0 && !isFetchingNextPage && (isPlaceholderData || isFetching);
  const showBusy = useDelayedFlag(isFetching && !isFetchingNextPage);
  const showUpdating = useDelayedFlag(cutRefetchActive);

  useEffect(() => {
    setExpanded(new Set());
    setActiveIndex(0);
    activeIndexRef.current = 0;
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [queryKey]);

  useEffect(() => {
    setActiveIndex((prev) => {
      if (items.length === 0) return 0;
      if (prev >= items.length) return items.length - 1;
      return prev;
    });
  }, [items.length]);

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
            currentSort={currentSort}
          />
        ),
        meta: { thClass: 'w-[11%]', sortKey: 'votes_helpful' as ReviewSortBy },
        cell: (info) => (
          <>
            <span className="votes-value">{formatInteger(info.getValue())}</span>
            <span className="mobile-meta-votes-label">{' '}úteis</span>
            <span className="mobile-meta-sep" aria-hidden="true"> · </span>
            <span className="mobile-meta-date">{formatDate(info.row.original.created_at)}</span>
          </>
        ),
      }),
      columnHelper.display({
        id: 'excerpt',
        header: () => (
          <div className="flex items-center justify-between gap-2">
            <span>Trecho</span>
            <SortHeaderButton
              label="Data"
              sortKey="created_at"
              currentSort={currentSort}
            />
          </div>
        ),
        meta: { thClass: 'w-[41%]', sortKey: 'created_at' as ReviewSortBy },
        cell: (info) => {
          const meta = info.table.options.meta;
          const reviewId = info.row.original.review_id;
          const isExpanded = meta?.expanded ? meta.expanded.has(reviewId) : false;
          return (
            <ExcerptCell
              item={info.row.original}
              isExpanded={isExpanded}
              onToggle={() => meta?.toggleExpanded?.(reviewId)}
            />
          );
        },
      }),
    ] as LegacyColumnDef<ReviewItem, unknown>[],
    [currentSort],
  );

  const table = useLegacyTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => String(row.review_id),
    meta: {
      expanded,
      toggleExpanded,
    },
  });

  const elementVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 8,
    enabled: !isMobile,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const windowVirtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => 104,
    overscan: 8,
    scrollMargin,
    enabled: isMobile,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualizer = isMobile ? windowVirtualizer : elementVirtualizer;
  const virtualRows = virtualizer.getVirtualItems();

  const activeMargin = isMobile ? scrollMargin : 0;
  const paddingTop =
    virtualRows.length > 0 ? Math.max(0, virtualRows[0].start - activeMargin) : 0;
  const lastRowEnd =
    virtualRows.length > 0 ? Math.max(0, virtualRows.at(-1)!.end - activeMargin) : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? Math.max(0, virtualizer.getTotalSize() - lastRowEnd)
      : 0;

  const lastVirtualRow = virtualRows.at(-1);
  const lastIndex = lastVirtualRow?.index;

  // Carrega mais itens quando o último item virtualizado se aproxima do fim da lista
  useEffect(() => {
    if (lastIndex === undefined) return;
    if (lastIndex >= items.length - 8 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [lastIndex, items.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Foco automático na linha ativa após navegação por teclado e renderização virtual
  useEffect(() => {
    if (!shouldFocusRef.current) return;

    let rafId: number;
    let attempts = 0;

    const focusTarget = () => {
      const selector = `tr[data-index="${activeIndex}"]`;
      const el =
        scrollRef.current?.querySelector<HTMLTableRowElement>(selector) ??
        document.querySelector<HTMLTableRowElement>(selector);

      if (el) {
        if (document.activeElement !== el) {
          el.focus({ preventScroll: true });
        }
        shouldFocusRef.current = false;
      } else if (attempts < 10) {
        attempts++;
        rafId = requestAnimationFrame(focusTarget);
      } else {
        shouldFocusRef.current = false;
      }
    };

    rafId = requestAnimationFrame(focusTarget);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [activeIndex, virtualRows]);

  const handleRowKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLTableRowElement>,
      virtualIndex: number,
      reviewId: number,
      isExpanded: boolean,
    ) => {
      const count = items.length;
      if (count === 0) return;

      const currentIndex = activeIndexRef.current;
      let nextIndex: number | null = null;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          nextIndex = Math.min(count - 1, currentIndex + 1);
          break;
        case 'ArrowUp':
          e.preventDefault();
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case 'PageDown':
          e.preventDefault();
          nextIndex = Math.min(count - 1, currentIndex + 10);
          break;
        case 'PageUp':
          e.preventDefault();
          nextIndex = Math.max(0, currentIndex - 10);
          break;
        case 'Home':
          e.preventDefault();
          nextIndex = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIndex = Math.max(0, count - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          toggleExpanded(reviewId);
          return;
        case 'Escape':
          if (isExpanded) {
            e.preventDefault();
            toggleExpanded(reviewId);
          }
          return;
        default:
          return;
      }

      if (nextIndex !== null) {
        activeIndexRef.current = nextIndex;
        setActiveIndex(nextIndex);
        shouldFocusRef.current = true;
        virtualizer.scrollToIndex(nextIndex, { align: 'auto' });

        if (nextIndex >= count - 8 && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      }
    },
    [items.length, toggleExpanded, virtualizer, hasNextPage, isFetchingNextPage, fetchNextPage],
  );

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
    statusText = '';
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
        <p className="meta">Clique numa linha para ver os detalhes</p>
      </div>

      <div className="sheet-card">
        <div
          ref={scrollRef}
          className="sheet sheet-virtual"
          tabIndex={-1}
          role="region"
          aria-label="Tabela de avaliações"
          aria-describedby="reviews-keyboard-hint"
          data-reviews-virtual="true"
        >
          <table aria-describedby="reviews-keyboard-hint">
            <caption className="sr-only">
              Avaliações da seleção atual
              <span id="reviews-keyboard-hint">
                . Use as setas para percorrer as avaliações; Enter expande o texto.
              </span>
            </caption>
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
                      <p>Nenhuma avaliação neste recorte.</p>
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
                    const isRowActive = virtualRow.index === activeIndex;
                    return (
                      <tr
                        key={reviewId}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        tabIndex={isRowActive ? 0 : -1}
                        aria-expanded={isExpanded}
                        aria-label={`${row.original.app_name}, ${row.original.recommended ? 'Recomenda' : 'Não recomenda'}`}
                        aria-describedby={`review-excerpt-${reviewId}`}
                        className={isExpanded ? 'review-row is-expanded' : 'review-row'}
                        onKeyDown={(e) =>
                          handleRowKeyDown(e, virtualRow.index, reviewId, isExpanded)
                        }
                        onFocus={() => {
                          activeIndexRef.current = virtualRow.index;
                          setActiveIndex(virtualRow.index);
                        }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement | null;
                          if (target?.closest('button, a')) {
                            return;
                          }
                          const selection = window.getSelection()?.toString().trim();
                          if (selection) {
                            return;
                          }
                          activeIndexRef.current = virtualRow.index;
                          setActiveIndex(virtualRow.index);
                          toggleExpanded(reviewId);
                        }}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} data-col={cell.column.id}>
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
        ) : statusText ? (
          <span aria-live="polite" aria-atomic="true">
            {statusText}
          </span>
        ) : null}
      </p>

      <p className="reviews-note">
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
