/** ECharts option builders — presentation only. */
import type { EChartsOption } from 'echarts';
import type { BoxOfficeRun } from '../core/GameState';
import { formatMoney } from '../industry/BoxOfficeEngine';

const TEXT = '#e8ecf1';
const MUTED = '#8f9bab';
const GRID = '#2e3846';

export function boxOfficeOption(run: BoxOfficeRun): EChartsOption {
  const weeks = run.weeks.map((_, i) => `Wk ${i + 1}`);
  return {
    backgroundColor: 'transparent',
    textStyle: { color: TEXT, fontFamily: 'inherit' },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1b212b',
      borderColor: GRID,
      textStyle: { color: TEXT },
      valueFormatter: (v) => formatMoney(Number(v)),
    },
    legend: { data: ['Domestic', 'International'], textStyle: { color: MUTED }, top: 0 },
    grid: { left: 8, right: 8, top: 30, bottom: 4, containLabel: true },
    xAxis: { type: 'category', data: weeks, axisLine: { lineStyle: { color: GRID } }, axisLabel: { color: MUTED } },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: GRID } },
      axisLabel: { color: MUTED, formatter: (v: number) => formatMoney(v) },
    },
    series: [
      { name: 'Domestic', type: 'bar', stack: 'ww', data: run.weeks.map((w) => w.domestic), itemStyle: { color: '#e5b84a', borderRadius: [0, 0, 0, 0] } },
      { name: 'International', type: 'bar', stack: 'ww', data: run.weeks.map((w) => w.international), itemStyle: { color: '#5aa9e6', borderRadius: [4, 4, 0, 0] } },
    ],
  };
}
