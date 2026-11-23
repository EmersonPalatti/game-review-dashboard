import * as echarts from 'echarts/core';
import type { ECharts } from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  GitCompare,
  Loader2,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Undo2,
} from 'lucide';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ChatFiltersPayload } from '../../lib/api';
import type {
  ComparisonWidgetData,
  EngagementWidgetData,
  GenUIWidget,
  LanguageWidgetBar,
  PlaytimeWidgetPoint,
  ReviewEvidenceItem,
  StructuredFilterAction,
  ToolStepState,
} from '../../lib/chatStream';
import { formatHours, formatInteger, formatPercent, languageLabel } from '../../lib/format';
import {
  filters as filtersAtom,
  isPlaytimeBucket,
  resetFilters,
  type Filters,
  type Tri,
} from '../../stores/filters';
import { theme } from '../../stores/theme';
import { RailIcon } from './RailIcon';

echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export const TOOL_LABELS: Record<string, string> = {
  resolve_game: 'Catálogo (59 jogos)',
  get_metrics: 'KPIs & Rankings',
  get_charts: 'Séries & Playtime',
  get_reviews_sample: 'Amostra de Reviews',
  get_engagement_stats: 'Engajamento',
  compare_slices: 'Comparativo A vs B',
  search_reviews_hybrid: 'Busca Híbrida (FTS5 + Vetor)',
  propose_dashboard_actions: 'Ações do Painel',
};

function boolToTri(val: boolean | null | undefined, fallback: Tri): Tri {
  if (val === true) return 'yes';
  if (val === false) return 'no';
  return fallback;
}

export function applyChatFiltersToStore(
  patch: Partial<ChatFiltersPayload> | undefined,
  reset = false,
): void {
  if (reset) {
    resetFilters();
    if (!patch || Object.keys(patch).length === 0) return;
  }
  if (!patch) return;
  const current = filtersAtom.get();
  filtersAtom.set({
    appId: patch.app_id !== undefined ? patch.app_id : current.appId,
    language: patch.language !== undefined ? patch.language : current.language,
    dateFrom: patch.date_from !== undefined ? patch.date_from : current.dateFrom,
    dateTo: patch.date_to !== undefined ? patch.date_to : current.dateTo,
    recommended:
      patch.recommended !== undefined ? boolToTri(patch.recommended, current.recommended) : current.recommended,
    steamPurchase:
      patch.steam_purchase !== undefined
        ? boolToTri(patch.steam_purchase, current.steamPurchase)
        : current.steamPurchase,
    receivedForFree:
      patch.received_for_free !== undefined
        ? boolToTri(patch.received_for_free, current.receivedForFree)
        : current.receivedForFree,
    earlyAccess:
      patch.early_access !== undefined
        ? boolToTri(patch.early_access, current.earlyAccess)
        : current.earlyAccess,
    playtime:
      patch.playtime_bucket !== undefined && patch.playtime_bucket !== null && isPlaytimeBucket(patch.playtime_bucket)
        ? patch.playtime_bucket
        : patch.playtime_bucket === null
        ? 'all'
        : current.playtime,
  });
}

function isActionApplied(current: Filters, action: StructuredFilterAction): boolean {
  const f = action.filters;
  if (action.reset && Object.keys(f).length === 0) {
    return (
      current.appId === null &&
      current.language === null &&
      current.dateFrom === null &&
      current.dateTo === null &&
      current.recommended === 'all' &&
      current.steamPurchase === 'all' &&
      current.receivedForFree === 'all' &&
      current.earlyAccess === 'all' &&
      current.playtime === 'all'
    );
  }
  let hasComparable = false;
  if (f.app_id !== undefined && f.app_id !== null) {
    hasComparable = true;
    if (current.appId !== f.app_id) return false;
  }
  if (f.language !== undefined && f.language !== null) {
    hasComparable = true;
    if (current.language !== f.language) return false;
  }
  if (f.recommended !== undefined && f.recommended !== null) {
    hasComparable = true;
    if (current.recommended !== (f.recommended ? 'yes' : 'no')) return false;
  }
  if (f.early_access !== undefined && f.early_access !== null) {
    hasComparable = true;
    if (current.earlyAccess !== (f.early_access ? 'yes' : 'no')) return false;
  }
  if (f.steam_purchase !== undefined && f.steam_purchase !== null) {
    hasComparable = true;
    if (current.steamPurchase !== (f.steam_purchase ? 'yes' : 'no')) return false;
  }
  if (f.received_for_free !== undefined && f.received_for_free !== null) {
    hasComparable = true;
    if (current.receivedForFree !== (f.received_for_free ? 'yes' : 'no')) return false;
  }
  if (f.playtime_bucket !== undefined && f.playtime_bucket !== null) {
    hasComparable = true;
    if (current.playtime !== f.playtime_bucket) return false;
  }
  if (f.date_from !== undefined && f.date_from !== null) {
    hasComparable = true;
    if (current.dateFrom !== f.date_from) return false;
  }
  if (f.date_to !== undefined && f.date_to !== null) {
    hasComparable = true;
    if (current.dateTo !== f.date_to) return false;
  }
  return hasComparable;
}

export function ToolExecutionTimeline({
  steps,
  isStreaming,
  elapsedMs,
}: {
  steps: ToolStepState[];
  isStreaming: boolean;
  elapsedMs: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (steps.length === 0) return null;

  const totalToolMs = steps.reduce((acc, s) => acc + (s.durationMs ?? 0), 0);
  const runningCount = steps.filter((s) => s.status === 'running').length;

  if (!isStreaming) {
    return (
      <div className="chat-tool-timeline is-collapsed">
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="chat-tool-summary-btn"
          aria-expanded={expanded}
        >
          <RailIcon icon={Database} className="w-3 h-3 text-[var(--accent)] flex-none" />
          <span>
            {steps.length} {steps.length === 1 ? 'consulta MCP' : 'consultas MCP'}
            {totalToolMs > 0 ? ` · ${totalToolMs} ms` : ''}
          </span>
          <RailIcon
            icon={expanded ? ChevronDown : ChevronRight}
            className="w-3.5 h-3.5 ml-auto text-[var(--muted)]"
          />
        </button>

        {expanded && (
          <ul className="chat-tool-step-list">
            {steps.map((step) => (
              <li key={step.id} className="chat-tool-step-item">
                <RailIcon
                  icon={CheckCircle2}
                  className={`w-3.5 h-3.5 flex-none ${
                    step.status === 'error' ? 'text-[var(--negative)]' : 'text-[var(--accent)]'
                  }`}
                />
                <span className="chat-tool-step-name">{TOOL_LABELS[step.name] ?? step.name}</span>
                {step.summary && <span className="chat-tool-step-meta">{step.summary}</span>}
                {typeof step.durationMs === 'number' && step.durationMs > 0 && (
                  <span className="chat-tool-step-ms">{step.durationMs} ms</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="chat-tool-timeline is-live" role="status" aria-live="polite">
      <div className="chat-tool-live-head">
        <span className="chat-tool-live-label">
          {runningCount > 0 ? 'Consultando MCP + SQLite...' : 'Sintetizando análise...'}
        </span>
        <span className="chat-tool-step-ms">{(elapsedMs / 1000).toFixed(1)}s</span>
      </div>
      <ul className="chat-tool-step-list">
        {steps.map((step) => (
          <li key={step.id} className="chat-tool-step-item">
            {step.status === 'running' ? (
              <RailIcon icon={Loader2} className="w-3.5 h-3.5 flex-none text-[var(--accent)] animate-spin" />
            ) : (
              <RailIcon
                icon={CheckCircle2}
                className={`w-3.5 h-3.5 flex-none ${
                  step.status === 'error' ? 'text-[var(--negative)]' : 'text-[var(--accent)]'
                }`}
              />
            )}
            <span className="chat-tool-step-name">{TOOL_LABELS[step.name] ?? step.name}</span>
            {step.summary && <span className="chat-tool-step-meta">{step.summary}</span>}
            {typeof step.durationMs === 'number' && step.durationMs > 0 && (
              <span className="chat-tool-step-ms">{step.durationMs} ms</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ComparisonWidget({ title, data }: { title: string; data: ComparisonWidgetData }) {
  const { slice_a: a, slice_b: b, deltas } = data;
  const deltaPositive = deltas.approval_delta_pp >= 0;
  const deltaSign = deltas.approval_delta_pp > 0 ? '+' : '';

  return (
    <section className="chat-genui-card" aria-label={title}>
      <header className="chat-genui-head">
        <span className="chat-genui-title">
          <RailIcon icon={GitCompare} className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
          <span>{title}</span>
        </span>
        <span className={`chat-genui-badge ${deltaPositive ? 'is-pos' : 'is-neg'}`}>
          {deltaSign}
          {deltas.approval_delta_pp.toFixed(1).replace('.', ',')} p.p.
        </span>
      </header>

      <div className="chat-genui-compare-grid">
        {[a, b].map((slice, idx) => (
          <div key={idx} className="chat-genui-subcard">
            <div className="chat-genui-sublabel">{slice.label}</div>
            <div className="chat-genui-figure">{formatPercent(slice.recommendation_rate)}</div>
            <div className="chat-genui-meta-row">
              <span>{formatInteger(slice.total_reviews)} reviews</span>
              <span>{slice.avg_votes_helpful.toFixed(2).replace('.', ',')} úteis/rev</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function EngagementWidget({ title, data }: { title: string; data: EngagementWidgetData }) {
  const { positive: pos, negative: neg, helpful_ratio_neg_vs_pos: ratio } = data;
  const maxHelpful = Math.max(pos.avg_votes_helpful, neg.avg_votes_helpful, 0.01);

  return (
    <section className="chat-genui-card" aria-label={title}>
      <header className="chat-genui-head">
        <span className="chat-genui-title">
          <RailIcon icon={Sparkles} className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
          <span>{title}</span>
        </span>
        {ratio !== null && (
          <span className="chat-genui-badge is-neg">
            {ratio.toFixed(2).replace('.', ',')}x votos úteis nas negativas
          </span>
        )}
      </header>

      <div className="chat-genui-bars">
        <div className="chat-genui-bar-row">
          <span className="chat-genui-bar-label">Positivas</span>
          <div className="chat-genui-bar-track">
            <div
              className="chat-genui-bar-fill is-pos"
              style={{ width: `${Math.max(4, (pos.avg_votes_helpful / maxHelpful) * 100)}%` }}
            />
          </div>
          <span className="chat-genui-bar-val">
            {pos.avg_votes_helpful.toFixed(2).replace('.', ',')} · {Math.round(pos.avg_excerpt_chars)} chars
          </span>
        </div>
        <div className="chat-genui-bar-row">
          <span className="chat-genui-bar-label">Negativas</span>
          <div className="chat-genui-bar-track">
            <div
              className="chat-genui-bar-fill is-neg"
              style={{ width: `${Math.max(4, (neg.avg_votes_helpful / maxHelpful) * 100)}%` }}
            />
          </div>
          <span className="chat-genui-bar-val">
            {neg.avg_votes_helpful.toFixed(2).replace('.', ',')} · {Math.round(neg.avg_excerpt_chars)} chars
          </span>
        </div>
      </div>
    </section>
  );
}

function MiniEChartWidget({
  title,
  mode,
  playtime,
  languages,
}: {
  title: string;
  mode: 'playtime' | 'language';
  playtime?: PlaytimeWidgetPoint[];
  languages?: LanguageWidgetBar[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentTheme = useSyncExternalStore(theme.subscribe, theme.get, () => 'light');

  const items = useMemo(() => {
    if (mode === 'playtime' && playtime) {
      return playtime.map((p) => ({
        name: p.label,
        pct: p.recommendation_rate !== null ? Math.round(p.recommendation_rate * 1000) / 10 : 0,
        count: p.review_count,
        isWarning: p.key === 'lt1' || p.key === 'h1_2',
      }));
    }
    if (mode === 'language' && languages) {
      return languages.slice(0, 6).map((l) => ({
        name: languageLabel(l.language).split(' ')[0] ?? l.language,
        pct: l.recommendation_rate !== null ? Math.round(l.recommendation_rate * 1000) / 10 : 0,
        count: l.review_count,
        isWarning: (l.recommendation_rate ?? 1) < 0.7,
      }));
    }
    return [];
  }, [mode, playtime, languages]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || items.length === 0) return;

    const styles = getComputedStyle(document.documentElement);
    const accent = styles.getPropertyValue('--accent').trim() || '#1f4e46';
    const negative = styles.getPropertyValue('--negative').trim() || '#9d341f';
    const secondary = styles.getPropertyValue('--secondary').trim() || '#5c564e';
    const line = styles.getPropertyValue('--line').trim() || '#e3e3df';
    const surface = styles.getPropertyValue('--surface').trim() || '#ffffff';
    const ink = styles.getPropertyValue('--ink').trim() || '#1c1915';

    const chart: ECharts = echarts.init(el);
    chart.setOption({
      animationDuration: 260,
      grid: { top: 10, right: 10, bottom: 26, left: 34 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: line,
        textStyle: { color: ink, fontSize: 11 },
        formatter: (params: unknown) => {
          const arr = Array.isArray(params) ? params : [params];
          const first = arr[0] as { dataIndex?: number } | undefined;
          const idx = first?.dataIndex ?? 0;
          const item = items[idx];
          if (!item) return '';
          return `${item.name}: <b>${item.pct.toFixed(1).replace('.', ',')}%</b> (${formatInteger(item.count)} rev.)`;
        },
      },
      xAxis: {
        type: 'category',
        data: items.map((i) => i.name),
        axisLine: { lineStyle: { color: line } },
        axisTick: { show: false },
        axisLabel: { color: secondary, fontSize: 10, interval: 0 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        splitNumber: 2,
        axisLabel: { color: secondary, fontSize: 10, formatter: '{value}%' },
        splitLine: { lineStyle: { color: line, type: 'dashed' } },
      },
      series: [
        {
          type: 'bar',
          barMaxWidth: 22,
          data: items.map((i) => ({
            value: i.pct,
            itemStyle: {
              color: i.isWarning ? negative : accent,
              borderRadius: [3, 3, 0, 0],
            },
          })),
        },
      ],
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [items, currentTheme]);

  if (items.length === 0) return null;

  return (
    <section className="chat-genui-card" aria-label={title}>
      <header className="chat-genui-head">
        <span className="chat-genui-title">
          <RailIcon icon={BarChart3} className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
          <span>{title}</span>
        </span>
      </header>
      <div ref={containerRef} className="chat-genui-chart" />
    </section>
  );
}

function ReviewEvidenceWidget({
  title,
  mode,
  items,
}: {
  title: string;
  mode: string;
  items: ReviewEvidenceItem[];
}) {
  if (items.length === 0) return null;

  const modeBadge =
    mode === 'hybrid' ? 'FTS5 + Vetor' : mode === 'fts5_only' ? 'FTS5' : 'SQL';

  return (
    <section className="chat-genui-card" aria-label={title}>
      <header className="chat-genui-head">
        <span className="chat-genui-title">
          <RailIcon icon={Search} className="w-3.5 h-3.5 text-[var(--accent)] flex-none" />
          <span className="truncate">{title}</span>
        </span>
        <span className="chat-genui-badge">{modeBadge}</span>
      </header>
      <ul className="chat-evidence-list">
        {items.slice(0, 4).map((item) => (
          <li key={item.review_id} className="chat-evidence-item">
            <div className="chat-evidence-meta">
              <span className={`chat-evidence-sentiment ${item.recommended ? 'is-pos' : 'is-neg'}`}>
                {item.recommended ? 'Positiva' : 'Negativa'}
              </span>
              <strong className="font-medium text-[var(--ink)] truncate">{item.app_name}</strong>
              {item.playtime_at_review_hours !== null && (
                <span>· {formatHours(item.playtime_at_review_hours)}</span>
              )}
              <span className="ml-auto font-mono">{formatInteger(item.votes_helpful)} úteis</span>
            </div>
            <p className="chat-evidence-excerpt">"{item.excerpt}"</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GenUIWidgetList({ widgets }: { widgets: GenUIWidget[] }) {
  if (!widgets || widgets.length === 0) return null;

  return (
    <div className="chat-genui-stack">
      {widgets.map((w, idx) => {
        if (w.type === 'comparison') {
          return <ComparisonWidget key={idx} title={w.title} data={w.data} />;
        }
        if (w.type === 'engagement') {
          return <EngagementWidget key={idx} title={w.title} data={w.data} />;
        }
        if (w.type === 'playtime_chart') {
          return (
            <MiniEChartWidget
              key={idx}
              title={w.title}
              mode="playtime"
              playtime={w.data.playtime}
            />
          );
        }
        if (w.type === 'language_chart') {
          return (
            <MiniEChartWidget
              key={idx}
              title={w.title}
              mode="language"
              languages={w.data.languages}
            />
          );
        }
        if (w.type === 'review_evidence') {
          return (
            <ReviewEvidenceWidget
              key={idx}
              title={w.title}
              mode={w.data.mode}
              items={w.data.items}
            />
          );
        }
        return null;
      })}
    </div>
  );
}

export function StructuredFilterChips({
  actions,
  currentFilters,
}: {
  actions: StructuredFilterAction[];
  currentFilters: Filters;
}) {
  const [undoSnapshot, setUndoSnapshot] = useState<Filters | null>(null);

  if (actions.length === 0) return null;

  const handleApply = (action: StructuredFilterAction) => {
    setUndoSnapshot({ ...currentFilters });
    applyChatFiltersToStore(action.filters, Boolean(action.reset));
  };

  const handleUndo = () => {
    if (!undoSnapshot) return;
    filtersAtom.set({ ...undoSnapshot });
    setUndoSnapshot(null);
  };

  return (
    <div className="chat-copilot-actions" role="group" aria-label="Ações de filtro recomendadas">
      <span className="text-[12px] leading-[16px] text-[var(--secondary)] flex items-center gap-1 mr-1">
        <RailIcon icon={Filter} className="w-3.5 h-3.5 text-[var(--accent)]" />
        <span>Painel:</span>
      </span>
      {actions.map((action, idx) => {
        const active = isActionApplied(currentFilters, action);
        return (
          <button
            key={action.id}
            type="button"
            style={{ '--chip-idx': idx } as React.CSSProperties}
            onClick={() => handleApply(action)}
            className={`chat-copilot-chip ${active ? 'chat-copilot-chip-active' : ''}`}
            title={action.reason || `Aplicar no painel: ${action.label}`}
          >
            {active && (
              <svg className="chat-chip-check" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M2.5 7.5L5.5 10.5L11.5 3.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <span>{action.label}</span>
          </button>
        );
      })}
      {undoSnapshot && (
        <button
          type="button"
          onClick={handleUndo}
          className="chat-undo-btn"
          title="Desfazer última alteração de filtro do chat"
        >
          <RailIcon icon={Undo2} className="w-3 h-3" />
          <span>Desfazer</span>
        </button>
      )}
    </div>
  );
}

export function FollowUpChips({
  followUps,
  disabled,
  onSelect,
}: {
  followUps: string[];
  disabled: boolean;
  onSelect: (question: string) => void;
}) {
  if (followUps.length === 0) return null;

  return (
    <div className="chat-followups" role="group" aria-label="Próximas perguntas sugeridas">
      {followUps.map((question, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(question)}
          className="chat-followup-chip"
        >
          {question}
        </button>
      ))}
    </div>
  );
}

export function FeedbackControls({
  traceId,
  feedback,
  onVote,
}: {
  traceId?: string;
  feedback?: 0 | 1 | null;
  onVote: (score: 0 | 1) => void;
}) {
  if (!traceId) return null;

  return (
    <div className="chat-feedback-group" role="group" aria-label="Avaliar qualidade da resposta">
      <button
        type="button"
        onClick={() => onVote(1)}
        aria-pressed={feedback === 1}
        className={`chat-feedback-btn ${feedback === 1 ? 'is-up' : ''}`}
        title="Resposta útil e fiel aos dados"
        aria-label="Marcar resposta como útil"
      >
        <RailIcon icon={ThumbsUp} className="w-3 h-3" />
      </button>
      <button
        type="button"
        onClick={() => onVote(0)}
        aria-pressed={feedback === 0}
        className={`chat-feedback-btn ${feedback === 0 ? 'is-down' : ''}`}
        title="Resposta imprecisa ou incompleta"
        aria-label="Marcar resposta como imprecisa"
      >
        <RailIcon icon={ThumbsDown} className="w-3 h-3" />
      </button>
    </div>
  );
}
