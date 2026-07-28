import type { ChartConfiguration, ChartOptions } from 'chart.js/auto';
import { Chart } from 'chart.js';

export interface ChartMetricSeries {
  label: string;
  field: 'weightKg' | 'bmi' | 'bodyFatPct' | 'muscleMassKg' | 'waistCm' | 'chestCm' | 'hipsCm' | 'contourCm' | 'armCm' | 'bodyWaterPct';
  color: string;
  yAxisID?: string;
}

export const METRIC_SERIES: ChartMetricSeries[] = [
  { label: 'measurements.series.weight', field: 'weightKg', color: '#3B82F6' },
  { label: 'measurements.series.bmi', field: 'bmi', color: '#8B5CF6' },
  { label: 'measurements.series.body_fat', field: 'bodyFatPct', color: '#EF4444' },
  { label: 'measurements.series.muscle', field: 'muscleMassKg', color: '#10B981' },
  { label: 'measurements.series.waist', field: 'waistCm', color: '#F59E0B' },
  { label: 'measurements.series.chest', field: 'chestCm', color: '#06B6D4' },
  { label: 'measurements.series.hips', field: 'hipsCm', color: '#EC4899' },
  { label: 'measurements.series.contour', field: 'contourCm', color: '#6366F1' },
  { label: 'measurements.series.arm', field: 'armCm', color: '#F97316' },
  { label: 'measurements.series.body_water', field: 'bodyWaterPct', color: '#0EA5E9' },
];

/**
 * Creates a canvas gradient fill mimicking Taiga UI's tui-line-chart style:
 * Linear gradient from top (50% opacity) to bottom (0% opacity) using the given color.
 */
function createGradientFill(color: string, context: { chart: Chart }): CanvasGradient | string {
  const { chart } = context;
  const { ctx, chartArea } = chart;
  
  if (!ctx || !chartArea) return color;
  
  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, `${color}80`); // 50% opacity at top
  gradient.addColorStop(1, `${color}00`); // 0% opacity at bottom
  
  return gradient;
}

export function buildChartConfig(
  labels: string[],
  datasets: { label: string; data: (number | null)[]; borderColor: string; backgroundColor: string }[]
): ChartConfiguration<'line'> {
  // Get CSS variables from root (Taiga UI theme colors)
  const cssVariables = getComputedStyle(document.documentElement);
  const textSecondary = cssVariables.getPropertyValue('--tui-text-secondary').trim() || '#64748b';
  const borderColor = cssVariables.getPropertyValue('--tui-border').trim() || '#e2e8f0';
  const bgElevation3 = cssVariables.getPropertyValue('--tui-background-elevation-3').trim() || '#ffffff';

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      intersect: false,
      mode: 'index',
    },
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          padding: 20,
          color: textSecondary,
          font: { family: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif", size: 12 },
        },
      },
      tooltip: {
        backgroundColor: bgElevation3,
        titleColor: textSecondary,
        bodyColor: textSecondary,
        borderColor: borderColor,
        borderWidth: 1,
        padding: 8,
        displayColors: true,
        boxPadding: 8,
        titleFont: { weight: 'bold', size: 12 } as any,
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          maxRotation: 45,
          color: textSecondary,
          font: { family: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif", size: 12 },
        },
      },
      y: {
        beginAtZero: false,
        grid: { color: borderColor },
        ticks: {
          color: textSecondary,
          font: { family: "'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', sans-serif", size: 12 },
        },
      },
    },
  };

  // Transform datasets to add fill gradient and point styling
  const styledDatasets = datasets.map(dataset => ({
    ...dataset,
    fill: true,
    tension: 0.3,
    backgroundColor: (context: { chart: Chart }) => createGradientFill(dataset.borderColor, context),
    borderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    pointBackgroundColor: dataset.borderColor,
    pointBorderColor: bgElevation3,
    pointBorderWidth: 2,
    spanGaps: true,
  }));

  return {
    type: 'line',
    data: { labels, datasets: styledDatasets },
    options: chartOptions,
  };
}
