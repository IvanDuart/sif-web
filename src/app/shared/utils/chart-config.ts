import type { ChartConfiguration, ChartType } from 'chart.js/auto';

export interface ChartMetricSeries {
  label: string;
  field: 'weightKg' | 'bmi' | 'bodyFatPct' | 'muscleMassKg';
  color: string;
  yAxisID?: string;
}

export const METRIC_SERIES: ChartMetricSeries[] = [
  { label: 'measurements.series.weight', field: 'weightKg', color: '#3B82F6' },
  { label: 'measurements.series.bmi', field: 'bmi', color: '#8B5CF6' },
  { label: 'measurements.series.body_fat', field: 'bodyFatPct', color: '#EF4444' },
  { label: 'measurements.series.muscle', field: 'muscleMassKg', color: '#10B981' },
];

export function buildChartConfig(
  labels: string[],
  datasets: { label: string; data: (number | null)[]; borderColor: string; backgroundColor: string }[]
): ChartConfiguration<'line'> {
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, padding: 20 },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 45 },
        },
        y: {
          beginAtZero: false,
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
    },
  };
}
