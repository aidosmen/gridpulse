import type { EChartsCoreOption } from 'echarts/core';
import { ChartWindow } from '../../core/domain/operations';

const muted = '#93a6ba';
const grid = 'rgba(176, 206, 224, 0.12)';
const cyan = '#3ee0c5';
const amber = '#e6b15a';

export function loadChart(actual: ChartWindow, forecast: ChartWindow): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: 480,
    tooltip: tooltip(),
    legend: { data: ['Demand', 'Forecast'], textStyle: { color: muted }, top: 0, right: 0 },
    grid: { left: 4, right: 8, top: 36, bottom: 4, containLabel: true },
    xAxis: axis(actual.labels),
    yAxis: valueAxis('MW'),
    series: [
      {
        name: 'Forecast',
        type: 'line',
        data: forecast.values,
        smooth: true,
        showSymbol: false,
        lineStyle: { type: 'dashed', width: 1.5, color: amber },
        itemStyle: { color: amber },
      },
      {
        name: 'Demand',
        type: 'line',
        data: actual.values,
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2.2, color: cyan },
        areaStyle: { color: 'rgba(62, 224, 197, 0.16)' },
        itemStyle: { color: cyan },
      },
    ],
  };
}

export function regionChart(labels: string[], values: number[]): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: 480,
    tooltip: tooltip(),
    grid: { left: 4, right: 8, top: 16, bottom: 4, containLabel: true },
    xAxis: valueAxis('MWh'),
    yAxis: { ...axis(labels), type: 'category', inverse: true },
    series: [
      {
        name: 'Energy',
        type: 'bar',
        data: values,
        barWidth: 12,
        itemStyle: { color: cyan, borderRadius: [0, 8, 8, 0] },
      },
    ],
  };
}

export function compareChart(labels: string[], left: number[], right: number[], leftName: string, rightName: string): EChartsCoreOption {
  return {
    backgroundColor: 'transparent',
    animationDuration: 480,
    tooltip: tooltip(),
    legend: { data: [leftName, rightName], textStyle: { color: muted }, top: 0 },
    grid: { left: 4, right: 8, top: 36, bottom: 4, containLabel: true },
    xAxis: axis(labels),
    yAxis: valueAxis('MW'),
    series: [
      line(leftName, left, cyan),
      line(rightName, right, amber),
    ],
  };
}

function line(name: string, data: number[], color: string) {
  return {
    name,
    type: 'line' as const,
    data,
    smooth: true,
    showSymbol: false,
    lineStyle: { width: 2, color },
    itemStyle: { color },
  };
}

function tooltip() {
  return {
    trigger: 'axis' as const,
    backgroundColor: '#101820',
    borderColor: 'rgba(176, 206, 224, 0.16)',
    textStyle: { color: '#e8eef5' },
  };
}

function axis(data: string[]) {
  return {
    type: 'category' as const,
    data,
    axisLabel: { color: muted, hideOverlap: true },
    axisLine: { lineStyle: { color: grid } },
    axisTick: { show: false },
    splitLine: { show: false },
  };
}

function valueAxis(name: string) {
  return {
    type: 'value' as const,
    name,
    nameTextStyle: { color: muted },
    axisLabel: { color: muted },
    splitLine: { lineStyle: { color: grid } },
  };
}
