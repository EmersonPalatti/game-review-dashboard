import { HttpAgent, type AgentSubscriber } from '@ag-ui/client';
import {
  API_BASE,
  toChatFiltersPayload,
  type ChatFiltersPayload,
  type ChatHistoryItem,
} from './api';
import type { Filters } from '../stores/filters';

export type ToolStepState = {
  id: string;
  name: string;
  status: 'running' | 'done' | 'error';
  args?: Record<string, unknown>;
  durationMs?: number;
  summary?: string;
};

export type ComparisonSliceSummary = {
  label: string;
  applied_filters: Record<string, unknown>;
  total_reviews: number;
  recommendation_rate: number;
  approval_pct: number;
  game_count: number;
  author_count: number;
  avg_votes_helpful: number;
  avg_playtime_hours: number | null;
};

export type ComparisonWidgetData = {
  slice_a: ComparisonSliceSummary;
  slice_b: ComparisonSliceSummary;
  deltas: {
    approval_delta_pp: number;
    review_count_diff: number;
    review_volume_ratio: number | null;
    helpful_votes_diff: number;
    avg_playtime_hours_diff: number | null;
  };
};

export type EngagementBucketData = {
  review_count: number;
  avg_votes_helpful: number;
  max_votes_helpful: number;
  avg_votes_funny: number;
  avg_comment_count: number;
  avg_playtime_hours: number | null;
  avg_excerpt_chars: number;
};

export type EngagementWidgetData = {
  overall: EngagementBucketData;
  positive: EngagementBucketData;
  negative: EngagementBucketData;
  helpful_ratio_neg_vs_pos: number | null;
  excerpt_length_ratio_neg_vs_pos: number | null;
};

export type PlaytimeWidgetPoint = {
  key: string;
  label: string;
  review_count: number;
  recommendation_rate: number | null;
};

export type LanguageWidgetBar = {
  language: string;
  review_count: number;
  recommendation_rate: number | null;
};

export type ReviewEvidenceItem = {
  review_id: number;
  app_id: number;
  app_name: string;
  language: string;
  recommended: boolean;
  votes_helpful: number;
  playtime_at_review_hours: number | null;
  created_at: string;
  excerpt: string;
  match_source: string;
  rrf_score: number;
};

export type GenUIWidget =
  | { type: 'comparison'; title: string; data: ComparisonWidgetData }
  | { type: 'engagement'; title: string; data: EngagementWidgetData }
  | { type: 'playtime_chart'; title: string; data: { playtime: PlaytimeWidgetPoint[] } }
  | { type: 'language_chart'; title: string; data: { languages: LanguageWidgetBar[] } }
  | {
      type: 'review_evidence';
      title: string;
      data: { query: string; mode: string; items: ReviewEvidenceItem[] };
    };

export type StructuredFilterAction = {
  id: string;
  label: string;
  filters: Partial<ChatFiltersPayload>;
  reset?: boolean;
  reason?: string | null;
};

export type ChatRunMetadata = {
  trace_id: string;
  model: string;
  tools_used: string[];
  latency_ms: number;
  langfuse_enabled?: boolean;
};

export type ChatStreamCallbacks = {
  onToolStart: (id: string, name: string) => void;
  onToolArgs: (id: string, args: Record<string, unknown>) => void;
  onToolResult: (id: string, summary: string, isError: boolean) => void;
  onToolTiming: (id: string, durationMs: number) => void;
  onTextDelta: (delta: string) => void;
  onWidget: (widget: GenUIWidget) => void;
  onDashboardActions: (
    actions: StructuredFilterAction[],
    followUps: string[],
    autoApply: boolean,
  ) => void;
  onStateFilters: (snapshot: { filters?: Partial<ChatFiltersPayload>; reset?: boolean }) => void;
  onMetadata: (meta: ChatRunMetadata) => void;
  onError: (error: Error) => void;
  onFinish: () => void;
};

function summarizeToolResult(content: string): { summary: string; isError: boolean } {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.error === 'string' && parsed.error) {
      return { summary: 'Erro na consulta', isError: true };
    }
    if (typeof parsed.total_reviews === 'number') {
      return { summary: `${parsed.total_reviews.toLocaleString('pt-BR')} reviews`, isError: false };
    }
    if (Array.isArray(parsed.matched_games)) {
      return { summary: `${parsed.matched_games.length} jogo(s)`, isError: false };
    }
    if (Array.isArray(parsed.items)) {
      return { summary: `${parsed.items.length} evidências`, isError: false };
    }
    if (parsed.slice_a && parsed.slice_b) {
      return { summary: 'Comparativo pronto', isError: false };
    }
    if (parsed.overall && typeof parsed.overall === 'object') {
      return { summary: 'Engajamento calculado', isError: false };
    }
    if (Array.isArray(parsed.playtime)) {
      return { summary: `${parsed.playtime.length} faixas`, isError: false };
    }
    if (Array.isArray(parsed.actions)) {
      return { summary: `${parsed.actions.length} ação(ões)`, isError: false };
    }
  } catch {
    // Texto simples
  }
  return { summary: 'Concluído', isError: false };
}

function createRunId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function streamChatAgui(
  message: string,
  currentFilters: Readonly<Filters>,
  history: ChatHistoryItem[],
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  let activeAbortError = false;
  let errorDispatched = false;

  const dispatchError = (err: Error) => {
    if (activeAbortError || errorDispatched) return;
    errorDispatched = true;
    callbacks.onError(err);
  };

  const agent = new HttpAgent({
    url: `${API_BASE}/api/chat/stream`,
    threadId: 'steam-dashboard-session',
    initialMessages: [
      ...history.map((item, idx) => ({
        id: `hist_${idx}`,
        role: item.role,
        content: item.content,
      })),
      {
        id: `user_${Date.now()}`,
        role: 'user' as const,
        content: message,
      },
    ],
    fetch: async (url, init) => {
      const response = await window.fetch(url, {
        ...init,
        signal: signal ?? init.signal,
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const detail = errorData?.detail;
        throw new Error(detail || `Erro ${response.status} ao consultar o agente.`);
      }
      return response;
    },
  });

  const onAbort = () => {
    activeAbortError = true;
    agent.abortRun();
  };
  if (signal) {
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }

  const subscriber: AgentSubscriber = {
    onToolCallStartEvent: ({ event }) => {
      callbacks.onToolStart(event.toolCallId, event.toolCallName);
    },
    onToolCallEndEvent: ({ event, toolCallArgs }) => {
      if (toolCallArgs && typeof toolCallArgs === 'object') {
        callbacks.onToolArgs(event.toolCallId, toolCallArgs);
      }
    },
    onToolCallResultEvent: ({ event }) => {
      const textContent =
        typeof event.content === 'string'
          ? event.content
          : Array.isArray(event.content)
          ? event.content
              .map((part) => (typeof part === 'object' && part && 'text' in part ? String(part.text) : ''))
              .join('')
          : '';
      const { summary, isError } = summarizeToolResult(textContent);
      callbacks.onToolResult(event.toolCallId, summary, isError);
    },
    onTextMessageContentEvent: ({ event }) => {
      if (event.delta) {
        callbacks.onTextDelta(event.delta);
      }
    },
    onCustomEvent: ({ event }) => {
      const val = event.value as Record<string, unknown> | undefined;
      if (!val) return;
      if (event.name === 'tool_timing' && typeof val.tool_call_id === 'string') {
        callbacks.onToolTiming(val.tool_call_id, Number(val.duration_ms ?? 0));
      } else if (event.name === 'genui_widget') {
        callbacks.onWidget(val as unknown as GenUIWidget);
      } else if (event.name === 'dashboard_actions') {
        const actions = Array.isArray(val.actions) ? (val.actions as StructuredFilterAction[]) : [];
        const followUps = Array.isArray(val.follow_ups) ? (val.follow_ups as string[]) : [];
        const autoApply = Boolean(val.auto_apply);
        callbacks.onDashboardActions(actions, followUps, autoApply);
      } else if (event.name === 'run_metadata') {
        callbacks.onMetadata(val as unknown as ChatRunMetadata);
      }
    },
    onStateSnapshotEvent: ({ event }) => {
      if (event.snapshot && typeof event.snapshot === 'object') {
        callbacks.onStateFilters(
          event.snapshot as { filters?: Partial<ChatFiltersPayload>; reset?: boolean },
        );
      }
    },
    onRunErrorEvent: ({ event }) => {
      dispatchError(new Error(event.message || 'Erro ao processar resposta do agente.'));
    },
    onRunFailed: ({ error }) => {
      dispatchError(error);
    },
    onRunFinishedEvent: () => {
      callbacks.onFinish();
    },
  };

  try {
    await agent.runAgent(
      {
        runId: createRunId(),
        forwardedProps: {
          filters: toChatFiltersPayload(currentFilters),
        },
      },
      subscriber,
    );
  } catch (err: unknown) {
    if (activeAbortError || (err instanceof Error && err.name === 'AbortError')) {
      return;
    }
    dispatchError(err instanceof Error ? err : new Error(String(err)));
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}

export async function sendChatFeedback(
  traceId: string,
  score: 0 | 1,
  comment?: string,
): Promise<{ recorded: boolean; traced: boolean; trace_id: string }> {
  const response = await fetch(`${API_BASE}/api/chat/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trace_id: traceId, score, comment }),
  });
  if (!response.ok) {
    throw new Error(`Erro ${response.status} ao registrar avaliação.`);
  }
  return (await response.json()) as { recorded: boolean; traced: boolean; trace_id: string };
}
