import * as echarts from 'echarts';
import type { ECharts, EChartsOption } from 'echarts';
import type { Charts } from '../lib/api';
import { formatInteger, formatPercent } from '../lib/format';
import type { PlaytimeBucket } from '../stores/filters';

const CHART_IDS = ['chart-month', 'chart-playtime'] as const;

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const charts = new Map<string, ECharts>();
let lastData: Charts | null = null;
let lastActivePlaytime: PlaytimeBucket = 'all';
let onSelectPlaytime: ((bucket: PlaytimeBucket) => void) | null = null;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function palette() {
  return {
    ink: token('--ink'),
    secondary: token('--secondary'),
    muted: token('--muted'),
    line: token('--line'),
    surface: token('--surface'),
    accent: token('--accent'),
    negative: token('--negative'),
    shadow: token('--shadow') || 'none',
  };
}

function formatMonth(value: string): string {
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

function resizeCharts(): void {
  for (const chart of charts.values()) chart.resize();
}

let chartObserver: ResizeObserver | null = null;

export function initCharts(onPlaytimeSelect?: (bucket: PlaytimeBucket) => void): void {
  if (onPlaytimeSelect) onSelectPlaytime = onPlaytimeSelect;
  window.removeEventListener('resize', resizeCharts);
  chartObserver?.disconnect();
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

function chart(id: string): ECharts {
  const instance = charts.get(id);
  if (!instance) throw new Error(`Gráfico não iniciado: ${id}`);
  return instance;
}

function setChartVisible(id: string, emptyId: string, visible: boolean): void {
  const element = document.getElementById(id);
  const empty = document.getElementById(emptyId);
  if (element) element.hidden = !visible;
  if (empty) empty.hidden = visible;
}

export function renderCharts(data: Charts, activePlaytime: PlaytimeBucket = lastActivePlaytime): void {
  lastData = data;
  lastActivePlaytime = activePlaytime;
  paint(data);
}

export function repaintCharts(): void {
  if (lastData) paint(lastData);
}

function paint(data: Charts): void {
  const colors = palette();
  paintMonth(data, colors);
  paintPlaytime(data, colors);
  window.requestAnimationFrame(resizeCharts);
}

function paintMonth(data: Charts, colors: ReturnType<typeof palette>): void {
  const visible = data.months.length > 0;
  setChartVisible('chart-month', 'chart-month-empty', visible);
  if (!visible) return;

  let peakIndex = 0;
  for (let index = 1; index < data.months.length; index += 1) {
    const current = data.months[index];
    const best = data.months[peakIndex];
    if (current && best && current.review_count > best.review_count) peakIndex = index;
  }
  const best = data.months[peakIndex];

  const monthElement = document.getElementById('chart-month');
  if (monthElement) {
    monthElement.setAttribute('role', 'img');
    if (best) {
      monthElement.setAttribute(
        'aria-label',
        `Avaliações por mês: ${data.months.length} meses no recorte, pico em ${formatMonth(best.month)} com ${formatInteger(best.review_count)} avaliações.`,
      );
    }
  }

  chart('chart-month').setOption(
    {
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
      tooltip: {
        ...tooltipBase(colors),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const row = Array.isArray(params) ? params[0] : params;
          const index = (row as { dataIndex: number }).dataIndex;
          const point = data.months[index];
          if (!point) return '';
          const peak = index === peakIndex ? '<br/>pico do recorte' : '';
          return `${formatMonth(point.month)}<br/>${formatInteger(point.review_count)} avaliações${peak}`;
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
        axisPointer: { type: 'line', lineStyle: { color: colors.line, type: 'solid' } },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: true, lineStyle: { color: colors.line } },
        axisLabel: {
          ...axisLabel(colors.muted),
          formatter: (value: number) => formatInteger(value),
        },
      },
      series: [
        {
          type: 'line',
          data: data.months.map((point) => point.review_count),
          showSymbol: false,
          cursor: 'default',
          lineStyle: { color: colors.secondary, width: 1.75 },
          itemStyle: { color: colors.secondary },
          emphasis: { disabled: true },
        },
        {
          type: 'scatter',
          data: data.months.map((point, index) => (index === peakIndex ? point.review_count : null)),
          symbolSize: 8,
          cursor: 'default',
          itemStyle: { color: colors.accent },
          tooltip: { show: false },
          z: 3,
        },
      ],
    } satisfies EChartsOption,
    true,
  );
}

function paintPlaytime(data: Charts, colors: ReturnType<typeof palette>): void {
  const visible = data.playtime.some((point) => point.review_count > 0);
  setChartVisible('chart-playtime', 'chart-playtime-empty', visible);
  if (!visible) return;

  const playtimeElement = document.getElementById('chart-playtime');
  if (playtimeElement) {
    playtimeElement.setAttribute('role', 'img');
    const totalReviews = data.playtime.reduce((sum, point) => sum + point.review_count, 0);
    const refundReviews = data.playtime
      .filter((point) => point.key === 'lt1' || point.key === 'h1_2')
      .reduce((sum, point) => sum + point.review_count, 0);
    playtimeElement.setAttribute(
      'aria-label',
      `Distribuição por tempo de jogo: ${formatInteger(totalReviews)} avaliações no total, sendo ${formatInteger(refundReviews)} na janela de reembolso Steam (< 2 h).`,
    );
  }

  chart('chart-playtime').setOption(
    {
      animation: false,
      backgroundColor: 'transparent',
      grid: { left: 8, right: 12, top: 16, bottom: 4, containLabel: true },
      tooltip: {
        ...tooltipBase(colors),
        trigger: 'axis',
        formatter: (params: unknown) => {
          const row = Array.isArray(params) ? params[0] : params;
          const index = (row as { dataIndex: number }).dataIndex;
          const point = data.playtime[index];
          if (!point) return '';
          const refund =
            point.key === 'lt1' || point.key === 'h1_2'
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
          ...axisLabel(colors.muted),
          interval: 0,
          rotate: 40,
          hideOverlap: false,
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
          type: 'bar',
          data: data.playtime.map((point) => {
            let color = colors.ink;
            let opacity: number | undefined;

            if (lastActivePlaytime !== 'all') {
              if (point.key === lastActivePlaytime) {
                color = colors.accent;
              } else {
                color = colors.muted;
                opacity = 0.45;
              }
            } else {
              if (point.key === 'lt1' || point.key === 'h1_2') {
                color = colors.negative;
              } else {
                color = colors.ink;
              }
            }

            return {
              value: point.recommendation_rate === null ? null : point.recommendation_rate * 100,
              itemStyle: {
                color,
                ...(opacity !== undefined ? { opacity } : {}),
                borderRadius: 0,
              },
            };
          }),
          barMaxWidth: 28,
          cursor: 'pointer',
          emphasis: {
            itemStyle: { color: colors.accent, shadowBlur: 0 },
          },
          markLine: {
            silent: true,
            symbol: ['none', 'none'],
            lineStyle: { color: colors.accent, type: 'dashed', width: 1 },
            label: {
              show: true,
              position: 'insideEndTop',
              formatter: 'Base 83,0%',
              color: colors.accent,
              fontFamily: '"IBM Plex Mono", monospace',
              fontSize: 11,
            },
            data: [{ yAxis: 82.97 }],
          },
        },
      ],
    } satisfies EChartsOption,
    true,
  );
}
