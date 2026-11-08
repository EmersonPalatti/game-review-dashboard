import * as echarts from 'echarts/core';
import type { ComposeOption, ECharts } from 'echarts/core';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import type { BarSeriesOption, LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import type {
  DataZoomComponentOption,
  GridComponentOption,
  MarkAreaComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type EChartsOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | ScatterSeriesOption
  | DataZoomComponentOption
  | GridComponentOption
  | MarkAreaComponentOption
  | MarkLineComponentOption
  | TooltipComponentOption
>;
import type { Charts, MonthPoint, PlaytimePoint } from '../lib/api';
import { BASELINE_RATE, REFUND_BUCKETS } from '../lib/constants';
import { formatCount, formatInteger, formatPercent } from '../lib/format';
import type { PlaytimeBucket } from '../stores/filters';

export type MonthMetric = 'volume' | 'approval';
// Último valor recebido do React (renderCharts/setMonthMetric). Nunca é decidido aqui.
let currentMonthMetric: MonthMetric = 'volume';

export function setMonthMetric(metric: MonthMetric): void {
  currentMonthMetric = metric;
  if (!lastData || lastData.months.length === 0) return;
  const colors = palette();
  paintMonth(lastData, colors, true);
  resizeCharts();
}

const approvalPercentFormat = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatApprovalRate(rate: number): string {
  return approvalPercentFormat.format(rate);
}

const CHART_IDS = ['chart-month', 'chart-playtime'] as const;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const charts = new Map<string, ECharts>();
let lastData: Charts | null = null;
let monthElement: HTMLElement | null = null;
let keyboardMonthIndex: number | null = null;
let lastActivePlaytime: PlaytimeBucket = 'all';
let lastActiveMonth: string | null = null;
type ZoomWindow = { start: number; end: number };

const FOCUS_MONTH_SPAN = 24;
const FOCUS_PAD_MONTHS = 2;
const FOCUS_MS = 220;

let lastMonthZoom: ZoomWindow | null = null;
let monthZoomBeforeFocus: ZoomWindow | null | undefined;
let pendingZoom: ZoomWindow | null | undefined;
let intendedZoom: ZoomWindow | null | undefined;
let focusAxisKey = '';
let zoomAnimFrame = 0;
let applyingZoom = false;
let suppressZoomEvent = false;
let lastAppliedZoom: ZoomWindow | null = null;
let onSelectPlaytime: ((bucket: PlaytimeBucket) => void) | null = null;
let onSelectMonth: ((month: string) => void) | null = null;
let onAnnounce: ((message: string) => void) | null = null;

function isFullWindow(zoom: ZoomWindow | null | undefined): boolean {
  if (!zoom) return true;
  return zoom.start <= 0.5 && zoom.end >= 99.5;
}

function storedZoom(zoom: ZoomWindow): ZoomWindow | null {
  return isFullWindow(zoom) ? null : { start: zoom.start, end: zoom.end };
}

function sameZoom(a: ZoomWindow | null, b: ZoomWindow | null): boolean {
  const left = a ?? { start: 0, end: 100 };
  const right = b ?? { start: 0, end: 100 };
  return Math.abs(left.start - right.start) < 0.4 && Math.abs(left.end - right.end) < 0.4;
}

function clampZoom(start: number, end: number): ZoomWindow {
  if (end - start >= 100) return { start: 0, end: 100 };
  let nextStart = start;
  let nextEnd = end;
  if (nextStart < 0) {
    nextEnd -= nextStart;
    nextStart = 0;
  }
  if (nextEnd > 100) {
    nextStart -= nextEnd - 100;
    nextEnd = 100;
  }
  return { start: Math.max(0, nextStart), end: Math.min(100, nextEnd) };
}

function axisKey(months: Array<{ month: string }>): string {
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) return '';
  return `${months.length}:${first.month}:${last.month}`;
}

function categoryCenter(index: number, count: number): number {
  return ((index + 0.5) / count) * 100;
}

function categoryWindow(startIndex: number, endIndex: number, count: number): ZoomWindow {
  return clampZoom((startIndex / count) * 100, ((endIndex + 1) / count) * 100);
}

function viewZoom(): ZoomWindow | null {
  return intendedZoom !== undefined ? intendedZoom : lastMonthZoom;
}

function focusWindow(index: number, count: number, current: ZoomWindow | null): ZoomWindow | null {
  if (count <= 12 || index < 0 || index >= count) return null;
  if (isFullWindow(current)) {
    const span = Math.min(FOCUS_MONTH_SPAN, count);
    const extra = span - 1;
    let startIndex = Math.round(index - extra / 2);
    let endIndex = startIndex + extra;
    if (startIndex < 0) {
      endIndex -= startIndex;
      startIndex = 0;
    }
    if (endIndex > count - 1) {
      startIndex -= endIndex - (count - 1);
      endIndex = count - 1;
    }
    const next = categoryWindow(Math.max(0, startIndex), endIndex, count);
    return sameZoom(next, current) ? null : next;
  }
  if (!current) return null;
  const start = current.start;
  const end = current.end;
  const center = categoryCenter(index, count);
  if (center >= start && center <= end) return null;
  const width = end - start;
  const pad = Math.min((FOCUS_PAD_MONTHS / count) * 100, width / 2);
  const next =
    center < start
      ? clampZoom(center - pad, center - pad + width)
      : clampZoom(center + pad - width, center + pad);
  return sameZoom(next, current) ? null : next;
}

function cancelZoomAnim(): void {
  if (zoomAnimFrame) {
    cancelAnimationFrame(zoomAnimFrame);
    zoomAnimFrame = 0;
  }
}

function applyZoom(window: ZoomWindow): void {
  const instance = charts.get('chart-month');
  if (!instance) return;
  lastAppliedZoom = window;
  applyingZoom = true;
  instance.dispatchAction({
    type: 'dataZoom',
    dataZoomId: 'month-zoom',
    dataZoomIndex: 0,
    start: window.start,
    end: window.end,
  });
  applyingZoom = false;
}

function animateZoom(target: ZoomWindow | null): void {
  cancelZoomAnim();
  intendedZoom = target;
  const to = target ?? { start: 0, end: 100 };
  const from = lastMonthZoom ?? { start: 0, end: 100 };
  const reduced = prefersReducedMotion();
  const started = performance.now();
  const step = (now: number) => {
    const progress = reduced ? 1 : Math.min(1, (now - started) / FOCUS_MS);
    const eased = 1 - (1 - progress) ** 3;
    const current = {
      start: from.start + (to.start - from.start) * eased,
      end: from.end + (to.end - from.end) * eased,
    };
    applyZoom(current);
    lastMonthZoom = storedZoom(current);
    if (progress < 1) {
      zoomAnimFrame = requestAnimationFrame(step);
      return;
    }
    zoomAnimFrame = 0;
    intendedZoom = undefined;
  };
  zoomAnimFrame = requestAnimationFrame(step);
}

function queueZoom(target: ZoomWindow | null): void {
  pendingZoom = target;
}

function rememberAndFocus(index: number, count: number): void {
  if (!lastData) return;
  const current = viewZoom();
  const next = focusWindow(index, count, current);
  if (!next) return;
  if (monthZoomBeforeFocus === undefined) {
    monthZoomBeforeFocus = current ? { start: current.start, end: current.end } : null;
    focusAxisKey = axisKey(lastData.months);
  }
  queueZoom(next);
}

function restoreFocusZoom(): void {
  if (monthZoomBeforeFocus === undefined) return;
  queueZoom(monthZoomBeforeFocus);
  monthZoomBeforeFocus = undefined;
  focusAxisKey = '';
}

function releaseFocusZoom(): void {
  monthZoomBeforeFocus = undefined;
  pendingZoom = undefined;
  intendedZoom = undefined;
  focusAxisKey = '';
  lastMonthZoom = null;
  lastAppliedZoom = null;
  cancelZoomAnim();
}

function echoesAppliedZoom(start: number, end: number): boolean {
  if (!lastAppliedZoom) return false;
  return (
    Math.abs(start - lastAppliedZoom.start) < 0.75 &&
    Math.abs(end - lastAppliedZoom.end) < 0.75
  );
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function motionConfig(animate: boolean) {
  const active = animate && !prefersReducedMotion();
  return {
    animation: active,
    animationDuration: active ? 340 : 0,
    animationDurationUpdate: active ? 340 : 0,
    animationEasing: 'quarticOut' as const,
    animationEasingUpdate: 'quarticOut' as const,
  };
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function palette() {
  return {
    ink: token('--ink'),
    secondary: token('--secondary'),
    muted: token('--muted'),
    line: token('--line'),
    raised: token('--raised'),
    surface: token('--surface'),
    accent: token('--accent'),
    negative: token('--negative'),
    shadow: token('--shadow') || 'none',
  };
}

// Taxa de aprovação: acima da base, acento; abaixo, negativo; na base, tinta. Igual às linhas de ranking.
const RATE_TONE_EPSILON = 0.00005; // 0,005 p.p., o mesmo limiar de zero usado nos rankings

function rateTone(rate: number, colors: ReturnType<typeof palette>): string {
  const diff = rate - BASELINE_RATE;
  if (Math.abs(diff) < RATE_TONE_EPSILON) return colors.ink;
  return diff > 0 ? colors.accent : colors.negative;
}

export function formatMonth(value: string): string {
  const [year, month] = value.split('-');
  const name = MONTHS[Number(month) - 1] ?? month;
  return `${name}/${year.slice(2)}`;
}

function axisLabel(color: string) {
  return {
    color,
    fontFamily: '"IBM Plex Mono", monospace',
    fontSize: 12,
    fontWeight: 400,
  };
}

function tooltipBase(colors: ReturnType<typeof palette>) {
  return {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 8,
    padding: [8, 12] as [number, number],
    textStyle: {
      color: colors.ink,
      fontFamily: '"IBM Plex Sans", sans-serif',
      fontSize: 14,
    },
    extraCssText: `box-shadow: ${colors.shadow};`,
  };
}

let resizeRafId: number | null = null;

function cancelPendingResize(): void {
  if (resizeRafId !== null) {
    window.cancelAnimationFrame(resizeRafId);
    resizeRafId = null;
  }
}

function performResize(): void {
  for (const chart of charts.values()) {
    const dom = chart.getDom();
    if (dom && dom.clientWidth > 0 && dom.clientHeight > 0) {
      chart.resize({ animation: { duration: 0 } });
    }
  }
}

function resizeCharts(): void {
  if (resizeRafId !== null) return;
  resizeRafId = window.requestAnimationFrame(() => {
    resizeRafId = null;
    performResize();
  });
}

let chartObserver: ResizeObserver | null = null;

function isClickableMonthPoint(
  monthChart: ECharts,
  x: number,
  y: number,
): boolean {
  if (monthChart.containPixel('grid', [x, y])) return true;
  const converted = monthChart.convertFromPixel({ seriesIndex: 0 }, [x, y]);
  if (!Array.isArray(converted) || !lastData || lastData.months.length === 0) return false;
  const dataIndex = Math.round(converted[0]);
  if (dataIndex < 0 || dataIndex >= lastData.months.length) return false;
  const pixel = monthChart.convertToPixel({ seriesIndex: 0 }, [dataIndex, 0]);
  if (!pixel) return false;
  const height = monthChart.getHeight();
  return Math.abs(x - pixel[0]) <= 28 && y >= 10 && y <= height - 22;
}

export function initCharts(
  onPlaytimeSelect?: (bucket: PlaytimeBucket) => void,
  onMonthSelect?: (month: string) => void,
  onAnnounceMessage?: (message: string) => void,
): void {
  if (onPlaytimeSelect) onSelectPlaytime = onPlaytimeSelect;
  if (onMonthSelect) onSelectMonth = onMonthSelect;
  if (onAnnounceMessage) onAnnounce = onAnnounceMessage;
  window.removeEventListener('resize', resizeCharts);
  chartObserver?.disconnect();
  cancelPendingResize();
  chartObserver = new ResizeObserver(() => resizeCharts());
  for (const id of CHART_IDS) {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Gráfico não encontrado: ${id}`);
    }
    const existing = echarts.getInstanceByDom(element);
    if (existing) existing.dispose();
    charts.set(id, echarts.init(element));
    chartObserver.observe(element);
  }
  const monthChart = chart('chart-month');
  monthChart.off('datazoom');
  monthChart.on('datazoom', (params: unknown) => {
    if (applyingZoom || suppressZoomEvent) return;
    const payload = params as {
      start?: number;
      end?: number;
      batch?: Array<{ start?: number; end?: number }>;
    };
    const start = payload.batch?.[0]?.start ?? payload.start ?? 0;
    const end = payload.batch?.[0]?.end ?? payload.end ?? 100;
    if (echoesAppliedZoom(start, end)) return;
    cancelZoomAnim();
    intendedZoom = undefined;
    lastAppliedZoom = null;
    if (start <= 0.5 && end >= 99.5) {
      lastMonthZoom = null;
    } else {
      lastMonthZoom = { start, end };
    }
  });
  const monthZr = monthChart.getZr();
  let downPoint: [number, number] | null = null;
  monthZr.on('mousedown', (event: { offsetX: number; offsetY: number }) => {
    downPoint = [event.offsetX, event.offsetY];
  });
  monthZr.on('mousemove', (event: { offsetX: number; offsetY: number }) => {
    const isClickable = isClickableMonthPoint(monthChart, event.offsetX, event.offsetY);
    monthZr.setCursorStyle(isClickable ? 'pointer' : 'default');
  });
  monthZr.on('click', (event: { offsetX: number; offsetY: number }) => {
    if (!lastData || !onSelectMonth || lastData.months.length === 0) return;
    if (
      downPoint &&
      Math.hypot(event.offsetX - downPoint[0], event.offsetY - downPoint[1]) > 5
    ) {
      return;
    }
    const pointInPixel: [number, number] = [event.offsetX, event.offsetY];
    if (!isClickableMonthPoint(monthChart, pointInPixel[0], pointInPixel[1])) return;
    const pointInGrid = monthChart.convertFromPixel({ seriesIndex: 0 }, pointInPixel);
    const dataIndex = Array.isArray(pointInGrid) ? Math.round(pointInGrid[0]) : -1;
    applyMonthAt(dataIndex);
  });
  attachMonthKeyboard(monthChart.getDom());
  const playtimeChart = chart('chart-playtime');
  playtimeChart.off('click');
  playtimeChart.on('click', (params: { dataIndex?: number }) => {
    if (typeof params.dataIndex !== 'number' || !lastData) return;
    const point = lastData.playtime[params.dataIndex];
    if (!point || !onSelectPlaytime) return;
    onSelectPlaytime(point.key as PlaytimeBucket);
  });
  window.addEventListener('resize', resizeCharts);
}

function announce(message: string): void {
  onAnnounce?.(message);
}

function peakMonthIndex(months: MonthPoint[]): number {
  let peak = 0;
  for (let index = 1; index < months.length; index += 1) {
    const current = months[index];
    const best = months[peak];
    if (current && best && current.review_count > best.review_count) peak = index;
  }
  return peak;
}

function lowestApprovalMonthIndex(months: MonthPoint[]): number {
  let lowest = -1;
  let minRate = Infinity;
  for (let index = 0; index < months.length; index += 1) {
    const point = months[index];
    if (
      point &&
      point.review_count >= 30 &&
      point.recommendation_rate !== null &&
      point.recommendation_rate !== undefined
    ) {
      if (point.recommendation_rate < minRate) {
        minRate = point.recommendation_rate;
        lowest = index;
      }
    }
  }
  return lowest;
}

/** Rótulo acessível do gráfico mensal. Undefined sem meses: o JSX mostra o rótulo de fallback. */
export function monthAriaLabel(data: Charts, metric: MonthMetric): string | undefined {
  if (data.months.length === 0) return undefined;
  if (metric === 'approval') {
    const lowestIndex = lowestApprovalMonthIndex(data.months);
    const lowestMonth = lowestIndex >= 0 ? data.months[lowestIndex] : null;
    const lowestInfo =
      lowestMonth &&
      lowestMonth.recommendation_rate !== null &&
      lowestMonth.recommendation_rate !== undefined
        ? `, menor aprovação em ${formatMonth(lowestMonth.month)} (${formatApprovalRate(lowestMonth.recommendation_rate)})`
        : '';
    return `Aprovação por mês: ${data.months.length} meses no recorte${lowestInfo}. Use as setas ou PageUp/PageDown para percorrer os meses.`;
  }
  const best = data.months[peakMonthIndex(data.months)];
  if (!best) return undefined;
  return `Avaliações por mês: ${data.months.length} meses no recorte, pico em ${formatMonth(best.month)} com ${formatInteger(best.review_count)} avaliações. Use as setas ou PageUp/PageDown para percorrer os meses.`;
}

function defaultMonthIndex(): number {
  if (!lastData || lastData.months.length === 0) return 0;
  const months = lastData.months;
  const activeIndex =
    lastActiveMonth === null ? -1 : months.findIndex((point) => point.month === lastActiveMonth);
  if (activeIndex >= 0) return activeIndex;
  if (currentMonthMetric === 'approval') {
    const lowest = lowestApprovalMonthIndex(months);
    if (lowest >= 0) return lowest;
  }
  return peakMonthIndex(months);
}

function applyMonthAt(index: number): void {
  if (!lastData || !onSelectMonth) return;
  const point = lastData.months[index];
  if (!point) return;
  const removing = lastActiveMonth === point.month;
  if (removing) restoreFocusZoom();
  else rememberAndFocus(index, lastData.months.length);
  announce(removing ? 'Filtro de mês removido.' : `Filtro aplicado: ${formatMonth(point.month)}.`);
  onSelectMonth(point.month);
}

function highlightMonth(index: number | null): void {
  const instance = charts.get('chart-month');
  if (!instance) return;
  instance.dispatchAction({ type: 'downplay', seriesIndex: 0 });
  if (index === null) {
    instance.dispatchAction({ type: 'hideTip' });
    return;
  }
  instance.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: index });
  instance.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: index });
}

function panToMonth(index: number): void {
  if (!lastData) return;
  const current = viewZoom();
  if (isFullWindow(current)) return;
  const next = focusWindow(index, lastData.months.length, current);
  if (next) animateZoom(next);
}

function setMonthCursor(index: number): void {
  if (!lastData || lastData.months.length === 0) return;
  const count = lastData.months.length;
  const next = Math.min(count - 1, Math.max(0, index));
  keyboardMonthIndex = next;
  panToMonth(next);
  highlightMonth(next);
  const point = lastData.months[next];
  if (!point) return;
  const active = point.month === lastActiveMonth ? ', filtro ativo' : '';
  if (currentMonthMetric === 'approval') {
    const rate = point.recommendation_rate;
    if (point.review_count >= 30 && rate !== null && rate !== undefined) {
      announce(
        `${formatMonth(point.month)}: ${formatApprovalRate(rate)} de aprovação, ${formatInteger(point.review_count)} avaliações${active}. Mês ${next + 1} de ${count}.`,
      );
    } else {
      const rateSuffix =
        rate !== null && rate !== undefined ? `, ${formatApprovalRate(rate)} de aprovação` : '';
      announce(
        `${formatMonth(point.month)}: amostra pequena (${formatInteger(point.review_count)} avaliações)${rateSuffix}${active}. Mês ${next + 1} de ${count}.`,
      );
    }
  } else {
    announce(
      `${formatMonth(point.month)}: ${formatInteger(point.review_count)} avaliações${active}. Mês ${next + 1} de ${count}.`,
    );
  }
}

function onMonthFocus(): void {
  if (!lastData || lastData.months.length === 0) return;
  setMonthCursor(keyboardMonthIndex ?? defaultMonthIndex());
}

function onMonthBlur(): void {
  keyboardMonthIndex = null;
  highlightMonth(null);
  announce('');
}

function onMonthKeydown(event: KeyboardEvent): void {
  if (!lastData || lastData.months.length === 0) return;
  const cursor = keyboardMonthIndex ?? defaultMonthIndex();
  switch (event.key) {
    case 'ArrowRight':
      event.preventDefault();
      setMonthCursor(cursor + 1);
      return;
    case 'ArrowLeft':
      event.preventDefault();
      setMonthCursor(cursor - 1);
      return;
    case 'PageDown':
      event.preventDefault();
      setMonthCursor(cursor + 12);
      return;
    case 'PageUp':
      event.preventDefault();
      setMonthCursor(cursor - 12);
      return;
    case 'Home':
      event.preventDefault();
      setMonthCursor(0);
      return;
    case 'End':
      event.preventDefault();
      setMonthCursor(lastData.months.length - 1);
      return;
    case 'Enter':
    case ' ':
      event.preventDefault();
      applyMonthAt(cursor);
      return;
    case 'Escape': {
      if (lastActiveMonth === null) return;
      event.preventDefault();
      const index = lastData.months.findIndex((point) => point.month === lastActiveMonth);
      if (index >= 0) applyMonthAt(index);
      return;
    }
    default:
      return;
  }
}

function attachMonthKeyboard(element: HTMLElement): void {
  detachMonthKeyboard();
  monthElement = element;
  element.addEventListener('focus', onMonthFocus);
  element.addEventListener('blur', onMonthBlur);
  element.addEventListener('keydown', onMonthKeydown);
}

function detachMonthKeyboard(): void {
  if (monthElement) {
    monthElement.removeEventListener('focus', onMonthFocus);
    monthElement.removeEventListener('blur', onMonthBlur);
    monthElement.removeEventListener('keydown', onMonthKeydown);
  }
  monthElement = null;
  keyboardMonthIndex = null;
}

function chart(id: string): ECharts {
  const instance = charts.get(id);
  if (!instance) throw new Error(`Gráfico não iniciado: ${id}`);
  return instance;
}

export function renderCharts(
  data: Charts,
  activePlaytime: PlaytimeBucket = lastActivePlaytime,
  activeMonth: string | null = lastActiveMonth,
  dateFilterActive = false,
  monthMetric: MonthMetric = currentMonthMetric,
): void {
  const key = axisKey(data.months);
  if (focusAxisKey && key !== focusAxisKey && monthZoomBeforeFocus !== undefined) {
    releaseFocusZoom();
  } else if (!dateFilterActive && lastActiveMonth !== null) {
    restoreFocusZoom();
  }
  lastData = data;
  currentMonthMetric = monthMetric;
  lastActivePlaytime = activePlaytime;
  lastActiveMonth = activeMonth;
  paint(data, true);
}

export function repaintCharts(): void {
  if (lastData) paint(lastData, false);
}

export function disposeCharts(): void {
  window.removeEventListener('resize', resizeCharts);
  chartObserver?.disconnect();
  chartObserver = null;
  cancelPendingResize();
  detachMonthKeyboard();
  announce('');
  for (const id of CHART_IDS) {
    const instance = charts.get(id);
    if (instance) {
      instance.dispose();
    }
    charts.delete(id);
  }
  lastData = null;
  lastActivePlaytime = 'all';
  lastActiveMonth = null;
  currentMonthMetric = 'volume';
  releaseFocusZoom();
  onSelectPlaytime = null;
  onSelectMonth = null;
  onAnnounce = null;
}

function paint(data: Charts, animate = true): void {
  const colors = palette();
  paintMonth(data, colors, animate);
  paintPlaytime(data, colors, animate);
  resizeCharts();
}

function paintMonth(data: Charts, colors: ReturnType<typeof palette>, animate: boolean): void {
  if (data.months.length === 0) return;

  const peakIndex = peakMonthIndex(data.months);
  const lowestIndex = lowestApprovalMonthIndex(data.months);
  const lowestMonth = lowestIndex >= 0 ? data.months[lowestIndex] : null;
  const activeIndex =
    lastActiveMonth !== null
      ? data.months.findIndex((point) => point.month === lastActiveMonth)
      : -1;

  if (data.months.length <= 12) {
    lastMonthZoom = null;
    pendingZoom = undefined;
    intendedZoom = undefined;
    lastAppliedZoom = null;
    cancelZoomAnim();
  }

  const zoomStart = lastMonthZoom ? lastMonthZoom.start : 0;
  const zoomEnd = lastMonthZoom ? lastMonthZoom.end : 100;
  const monthChart = chart('chart-month');

  let yMin = 0;
  let yMax = 1;
  if (currentMonthMetric === 'approval') {
    const reliableRates = data.months
      .filter(
        (p) =>
          p.review_count >= 30 &&
          p.recommendation_rate !== null &&
          p.recommendation_rate !== undefined,
      )
      .map((p) => p.recommendation_rate as number);
    const boundsRates = reliableRates.length > 0 ? [...reliableRates, BASELINE_RATE] : [BASELINE_RATE];
    const rMin = Math.min(...boundsRates);
    const rMax = Math.max(...boundsRates);
    // Limites em dezenas redondas: evita rótulos colados (ex.: 55% logo abaixo de 60%).
    yMin = Math.max(0, Math.floor((rMin - 0.02) * 10) / 10);
    yMax = Math.min(1, Math.ceil((rMax + 0.02) * 10) / 10);
    if (yMax <= yMin) {
      yMin = Math.max(0, yMin - 0.05);
      yMax = Math.min(1, yMax + 0.05);
    }
  }

  const seriesData =
    currentMonthMetric === 'approval'
      ? data.months.map((point) => {
          const rate = point.recommendation_rate;
          if (point.review_count < 30 || rate === null || rate === undefined) {
            return null;
          }
          return rate;
        })
      : data.months.map((point) => point.review_count);

  const peakScatterData =
    currentMonthMetric === 'approval'
      ? data.months.map((point, index) =>
          index === lowestIndex &&
          point.recommendation_rate !== null &&
          point.recommendation_rate !== undefined
            ? point.recommendation_rate
            : null,
        )
      : data.months.map((point, index) => (index === peakIndex ? point.review_count : null));

  const selectedScatterData =
    currentMonthMetric === 'approval'
      ? data.months.map((point, index) => {
          if (index !== activeIndex) return null;
          const rate = point.recommendation_rate;
          return point.review_count >= 30 && rate !== null && rate !== undefined ? rate : null;
        })
      : data.months.map((point, index) => (index === activeIndex ? point.review_count : null));

  const markLineData: any[] = [];
  if (currentMonthMetric === 'approval') {
    markLineData.push({
      yAxis: BASELINE_RATE,
      lineStyle: {
        color: colors.muted,
        type: [5, 4],
        width: 1.5,
      },
      label: {
        show: true,
        position: 'insideEndTop',
        distance: [0, 4],
        formatter: 'média geral',
        color: colors.muted,
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: 11,
        fontWeight: 500,
      },
    });
  }
  if (activeIndex >= 0 && lastActiveMonth !== null) {
    markLineData.push({
      xAxis: lastActiveMonth,
      lineStyle: {
        color: colors.accent,
        type: [5, 4],
        width: 1.5,
      },
      label: { show: false },
    });
  }

  // Marcador de pico (volume) ou de menor aprovação: na aprovação, a cor segue a base.
  const peakDimmed =
    activeIndex >= 0 && activeIndex !== (currentMonthMetric === 'approval' ? lowestIndex : peakIndex);
  const lowestRate = lowestMonth?.recommendation_rate;
  const peakTone =
    currentMonthMetric === 'approval' && lowestRate !== null && lowestRate !== undefined
      ? rateTone(lowestRate, colors)
      : colors.accent;

  suppressZoomEvent = true;
  try {
  monthChart.setOption(
    {
      ...motionConfig(animate),
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 16, bottom: 42, containLabel: true },
      dataZoom: [
        {
          id: 'month-zoom',
          type: 'slider',
          show: data.months.length > 2,
          xAxisIndex: 0,
          filterMode: 'filter',
          start: zoomStart,
          end: zoomEnd,
          height: 16,
          bottom: 4,
          left: 62,
          right: 16,
          borderColor: colors.line,
          backgroundColor: colors.raised,
          fillerColor: `${colors.accent}22`,
          dataBackground: {
            lineStyle: { color: colors.muted, width: 1, opacity: 0.45 },
            areaStyle: { color: colors.muted, opacity: 0.1 },
          },
          selectedDataBackground: {
            lineStyle: { color: colors.accent, width: 1.25, opacity: 0.85 },
            areaStyle: { color: colors.accent, opacity: 0.2 },
          },
          handleIcon:
            'path://M-1,-7 L1,-7 C1.7,-7 2.2,-6.4 2.2,-5.6 L2.2,5.6 C2.2,6.4 1.7,7 1,7 L-1,7 C-1.7,7 -2.2,6.4 -2.2,5.6 L-2.2,-5.6 C-2.2,-6.4 -1.7,-7 -1,-7 Z',
          handleSize: '100%',
          handleStyle: {
            color: colors.surface,
            borderColor: colors.accent,
            borderWidth: 1.5,
            shadowBlur: 0,
          },
          moveHandleSize: 0,
          emphasis: {
            handleStyle: {
              color: colors.accent,
              borderColor: colors.accent,
            },
          },
          textStyle: {
            color: colors.muted,
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: 11,
          },
          labelFormatter: (_value: number, valueStr: string) => formatMonth(valueStr),
          brushSelect: false,
        },
      ],
      tooltip: {
        ...tooltipBase(colors),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const row = Array.isArray(params) ? params[0] : params;
          const index = (row as { dataIndex: number }).dataIndex;
          const point = data.months[index];
          if (!point) return '';

          const action =
            index === activeIndex
              ? '<br/>Clique para limpar o filtro'
              : '<br/>Clique para filtrar o mês';

          if (currentMonthMetric === 'approval') {
            const rate = point.recommendation_rate;
            const rateStr =
              rate !== null && rate !== undefined ? `${formatApprovalRate(rate)} recomendam` : 'sem dados';
            const baseLine = `${formatMonth(point.month)} · ${rateStr} · ${formatInteger(point.review_count)} avaliações`;
            const smallSample =
              point.review_count < 30
                ? `<br/>amostra pequena (${formatCount(point.review_count, 'avaliação', 'avaliações')})`
                : '';
            const lowestNote =
              point.review_count >= 30 && index === lowestIndex
                ? '<br/>menor aprovação do recorte'
                : '';
            return `${baseLine}${smallSample}${lowestNote}${action}`;
          }

          const peak = index === peakIndex ? '<br/>pico do recorte' : '';
          return `${formatMonth(point.month)}<br/>${formatInteger(point.review_count)} avaliações${peak}${action}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.months.map((point) => point.month),
        axisLine: { show: true, lineStyle: { color: colors.line } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          ...axisLabel(colors.muted),
          hideOverlap: true,
          formatter: (value: string) => formatMonth(value),
        },
        axisPointer: {
          type: 'line',
          lineStyle: { color: colors.line, type: 'solid' },
          triggerEmphasis: true,
        },
      },
      yAxis: {
        type: 'value',
        min: currentMonthMetric === 'approval' ? yMin : 0,
        max: currentMonthMetric === 'approval' ? yMax : (null as any),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: colors.line } },
        axisLabel: {
          ...axisLabel(colors.muted),
          formatter:
            currentMonthMetric === 'approval'
              ? (value: number) => `${Math.round(value * 100)}%`
              : (value: number) => formatInteger(value),
        },
      },
      series: [
        {
          id: 'month-line',
          type: 'line',
          connectNulls: false,
          data: seriesData,
          showSymbol: false,
          symbol: 'circle',
          symbolSize: 6,
          cursor: 'pointer',
          lineStyle: {
            color: currentMonthMetric === 'approval' ? colors.accent : colors.secondary,
            width: 1.75,
          },
          itemStyle: { color: colors.accent },
          emphasis: {
            disabled: false,
            scale: 1.4,
            focus: 'none',
            itemStyle: {
              color: colors.accent,
              borderColor: colors.surface,
              borderWidth: 2,
            },
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            z: 2,
            data: markLineData,
          },
        },
        {
          id: 'month-peak',
          type: 'scatter',
          data: peakScatterData,
          symbolSize: 8,
          cursor: 'pointer',
          itemStyle: {
            color: peakDimmed ? colors.muted : peakTone,
            opacity: peakDimmed ? 0.55 : 1,
          },
          tooltip: { show: false },
          z: 3,
        },
        {
          id: 'month-selected',
          type: 'scatter',
          data: selectedScatterData,
          symbolSize: 9,
          cursor: 'pointer',
          itemStyle: {
            color: colors.accent,
            borderColor: colors.surface,
            borderWidth: 2,
          },
          tooltip: { show: false },
          z: 4,
        },
      ],
    } satisfies EChartsOption,
    { notMerge: false, lazyUpdate: false },
  );
  } finally {
    suppressZoomEvent = false;
  }
  if (pendingZoom !== undefined) {
    const target = pendingZoom;
    pendingZoom = undefined;
    animateZoom(target);
  }
  if (monthElement && document.activeElement === monthElement) {
    if (keyboardMonthIndex === null || keyboardMonthIndex >= data.months.length) {
      keyboardMonthIndex = defaultMonthIndex();
    }
    highlightMonth(keyboardMonthIndex);
  }
}

const jumpFormat = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

// Curto para caber na janela de duas faixas (1–2 h e menos de 1 h) sem invadir o eixo.
const REFUND_CAPTION = 'reembolso até 2 h';

type RefundStep = {
  /** Índice da faixa 1–2 h; o corte fica entre ela e a faixa seguinte (2–5 h). */
  before: number;
  after: number;
  /** Salto de aprovação entre as duas faixas, em p.p.; null quando não há base para medir. */
  jump: string | null;
};

/** Corte da janela de reembolso (1–2 h para 2–5 h), medido sobre as faixas do recorte atual. */
function refundStep(rows: PlaytimePoint[]): RefundStep | null {
  const before = rows.findIndex((row) => row.key === 'h1_2');
  const after = rows.findIndex((row) => row.key === 'h2_5');
  if (before < 0 || after !== before + 1) return null;
  const from = rows[before];
  const to = rows[after];
  if (!from || !to) return null;
  let jump: string | null = null;
  // Sem taxa ou sem avaliações em uma das faixas, o salto não tem base e não aparece.
  if (
    from.recommendation_rate !== null &&
    to.recommendation_rate !== null &&
    from.review_count > 0 &&
    to.review_count > 0
  ) {
    jump = `${jumpFormat.format((to.recommendation_rate - from.recommendation_rate) * 100)} p.p.`;
  }
  return { before, after, jump };
}

function hasPlaytimeReviews(data: Charts): boolean {
  return data.playtime.some((point) => point.review_count > 0);
}

/** Rótulo acessível do gráfico de tempo de jogo; undefined sem avaliações (o gráfico fica oculto). */
export function playtimeAriaLabel(data: Charts): string | undefined {
  if (!hasPlaytimeReviews(data)) return undefined;
  const rates = data.playtime
    .map((point) =>
      point.recommendation_rate === null
        ? `${point.label} sem dados`
        : `${point.label} ${formatPercent(point.recommendation_rate)}`,
    )
    .join(', ');
  const jump = refundStep(data.playtime)?.jump;
  const jumpText = jump ? ` Salto de ${jump} de 1 a 2 h para 2 a 5 h.` : '';
  return `Recomendação por tempo de jogo: ${rates}. Faixas até 2 h marcadas como janela de reembolso.${jumpText}`;
}

function paintPlaytime(data: Charts, colors: ReturnType<typeof palette>, animate: boolean): void {
  if (!hasPlaytimeReviews(data)) return;

  const refund = refundStep(data.playtime);

  chart('chart-playtime').setOption(
    {
      ...motionConfig(animate),
      backgroundColor: 'transparent',
      grid: { left: 48, right: 16, top: 20, bottom: 4, containLabel: false },
      tooltip: {
        ...tooltipBase(colors),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const row = Array.isArray(params) ? params[0] : params;
          const index = (row as { dataIndex: number }).dataIndex;
          const point = data.playtime[index];
          if (!point) return '';
          const refund = REFUND_BUCKETS.includes(point.key as PlaytimeBucket)
            ? '<br/>Janela de reembolso Steam (&lt; 2 h)'
            : '';
          const action = '<br/>Clique para filtrar a faixa';
          if (point.recommendation_rate === null) {
            return `${point.label}<br/>sem avaliações${refund}${action}`;
          }
          return `${point.label}<br/>${formatPercent(point.recommendation_rate)} · ${formatInteger(point.review_count)} avaliações${refund}${action}`;
        },
      },
      xAxis: {
        type: 'category',
        data: data.playtime.map((point) => point.label),
        axisLine: { show: true, lineStyle: { color: colors.line } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: colors.line } },
        axisLabel: {
          ...axisLabel(colors.muted),
          formatter: (value: number) => `${formatInteger(value)}%`,
        },
      },
      series: [
        {
          id: 'playtime-bars',
          type: 'bar',
          data: data.playtime.map((point) => {
            const rate = point.recommendation_rate;
            // Com faixa escolhida, as demais recuam; a cor segue acima ou abaixo da base, como no ranking.
            const dimmed = lastActivePlaytime !== 'all' && point.key !== lastActivePlaytime;

            return {
              value: rate === null ? null : rate * 100,
              itemStyle: {
                color: rate === null ? colors.ink : rateTone(rate, colors),
                opacity: dimmed ? 0.45 : 1,
                borderRadius: 0,
              },
            };
          }),
          barMaxWidth: 28,
          cursor: 'pointer',
          emphasis: {
            itemStyle: { shadowBlur: 0, opacity: 1 },
          },
          // Área da janela de reembolso (primeira faixa até 1–2 h): sua borda direita é o corte
          // exato em 2 h, pois a marcação de área usa as bordas das faixas. O rótulo fica nessa quina.
          markArea: {
            silent: true,
            data: refund
              ? [
                  [
                    {
                      xAxis: 0,
                      itemStyle: { color: `${colors.muted}14`, borderWidth: 0 },
                      label: {
                        show: true,
                        position: 'insideTopRight',
                        formatter: refund.jump
                          ? `{caption|${REFUND_CAPTION}}\n{value|${refund.jump}}`
                          : `{caption|${REFUND_CAPTION}}`,
                        rich: {
                          caption: {
                            color: colors.muted,
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 11,
                            lineHeight: 16,
                          },
                          value: {
                            color: colors.accent,
                            fontFamily: '"IBM Plex Mono", monospace',
                            fontSize: 12,
                            fontWeight: 500,
                            lineHeight: 16,
                          },
                        },
                      },
                    },
                    { xAxis: refund.before },
                  ],
                ]
              : [],
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            z: 4,
            data: [
              {
                yAxis: Number((BASELINE_RATE * 100).toFixed(2)),
                lineStyle: {
                  color: colors.surface,
                  type: 'solid',
                  width: 3.5,
                  opacity: 0.9,
                },
                label: { show: false },
              },
              {
                yAxis: Number((BASELINE_RATE * 100).toFixed(2)),
                lineStyle: {
                  color: colors.muted,
                  type: [5, 4],
                  width: 1.5,
                },
                label: {
                  show: true,
                  position: 'insideEndTop',
                  distance: [0, 4],
                  formatter: `Base ${formatPercent(BASELINE_RATE)}`,
                  color: colors.muted,
                  backgroundColor: colors.surface,
                  borderColor: colors.muted,
                  borderWidth: 1,
                  borderRadius: 4,
                  padding: [3, 6],
                  fontFamily: '"IBM Plex Mono", monospace',
                  fontSize: 11,
                  fontWeight: 500,
                },
              },
            ],
          },
        },
      ],
    } satisfies EChartsOption,
    { notMerge: false, lazyUpdate: false },
  );
}
