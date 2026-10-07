import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TuiCalendar, TuiDropdown, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiInputDate, TuiSegmented } from '@taiga-ui/kit';
import { TuiDay } from '@taiga-ui/cdk';

import { BodyMeasurementService } from '../../core/api/services/body-measurement.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/branding/theme.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { MeasurementPoint } from '../../core/api/models/body-measurement.model';
import { buildChartConfig, METRIC_SERIES } from '../../shared/utils/chart-config';
import type { ChartConfiguration } from 'chart.js/auto';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

type ChartType = 'composition' | 'anthropometry';

/** Campos numéricos de una medición que se pueden graficar/listar. */
type NumericField =
  | 'weightKg'
  | 'bmi'
  | 'bodyFatPct'
  | 'muscleMassPct'
  | 'bodyWaterPct'
  | 'waistCm'
  | 'chestCm'
  | 'hipsCm'
  | 'contourCm'
  | 'armCm';

/** Definición de una métrica mostrada en la evolución. */
interface MetricDef {
  field: NumericField;
  labelKey: string;
  unit: string;
  /** `true` cuando subir es una mejora (masa muscular, agua). */
  higherIsBetter: boolean;
  /** Métrica destacada (valor grande) de la fila del historial. */
  primary?: boolean;
}

/** Métrica resuelta de una fila del historial de medidas. */
export interface EvolutionMetricItem {
  field: string;
  labelKey: string;
  color: string;
  valueText: string;
  unit: string;
  /** Variación frente a la medición anterior, ya formateada (sin flecha). */
  deltaText: string | null;
  /** Clase de color de la variación (`text-ok` / `text-err` / neutro). */
  deltaClass: string;
  /** Flecha ▲ / ▼ (vacía si no hay variación significativa). */
  arrow: string;
}

/** Fila del historial de medidas (más reciente primero). */
export interface EvolutionRowItem {
  id: string;
  dateLabel: string;
  primary: EvolutionMetricItem;
  metrics: EvolutionMetricItem[];
}

const PCT_FIELDS = new Set<string>(['bmi', 'bodyFatPct', 'bodyWaterPct', 'muscleMassPct']);
const KG_FIELDS = new Set<string>(['weightKg']);
const CM_FIELDS = new Set<string>(['waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm']);

/**
 * Página de "Evolución" del paciente. Reúne en una sola pantalla lo que antes
 * era la tarjeta de la gráfica dentro del panel: rango de fechas, alternancia
 * Composición / Antropometría, la gráfica (misma configuración que la ficha de
 * usuario) y el historial de medidas con su variación frente a la anterior.
 *
 * Portado del patrón de `user-detail.page.html` (tabs de mediciones) para que
 * el diseño no difiera entre la ficha de usuario y el panel del paciente.
 */
@Component({
  selector: 'app-evolution',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoDirective,
    SkeletonComponent,
    EmptyState,
    TuiInput,
    TuiTextfield,
    TuiDropdown,
    TuiCalendar,
    TuiInputDate,
    TuiSegmented,
  ],
  templateUrl: './evolution.page.html',
})
export default class EvolutionPage implements OnInit, OnDestroy {
  private readonly measurementService = inject(BodyMeasurementService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly transloco = inject(TranslocoService);

  loading = signal(true);
  chartType = signal<ChartType>('composition');
  startDate = signal<TuiDay | null>(null);
  endDate = signal<TuiDay | null>(null);

  /** Todas las mediciones del paciente, sin filtrar. */
  private readonly points = signal<MeasurementPoint[]>([]);

  private readonly COMPOSITION_METRICS: MetricDef[] = [
    { field: 'weightKg', labelKey: 'evolution.weight', unit: 'kg', higherIsBetter: false, primary: true },
    { field: 'bmi', labelKey: 'measurements.bmi', unit: '', higherIsBetter: false },
    { field: 'bodyFatPct', labelKey: 'evolution.fat_pct', unit: '%', higherIsBetter: false },
    { field: 'muscleMassPct', labelKey: 'evolution.muscle', unit: '%', higherIsBetter: true },
    { field: 'bodyWaterPct', labelKey: 'evolution.water_pct', unit: '%', higherIsBetter: true },
  ];

  private readonly ANTHROPOMETRY_METRICS: MetricDef[] = [
    { field: 'waistCm', labelKey: 'evolution.perimeter_waist', unit: 'cm', higherIsBetter: false, primary: true },
    { field: 'chestCm', labelKey: 'evolution.perimeter_chest', unit: 'cm', higherIsBetter: false },
    { field: 'hipsCm', labelKey: 'evolution.perimeter_hips', unit: 'cm', higherIsBetter: false },
    { field: 'contourCm', labelKey: 'evolution.perimeter_contour', unit: 'cm', higherIsBetter: false },
    { field: 'armCm', labelKey: 'evolution.perimeter_arm', unit: 'cm', higherIsBetter: false },
  ];

  readonly chartFields = computed<MetricDef[]>(() =>
    this.chartType() === 'composition' ? this.COMPOSITION_METRICS : this.ANTHROPOMETRY_METRICS
  );

  /** Mediciones dentro del rango de fechas, ordenadas de la más antigua a la más nueva. */
  readonly filteredPoints = computed<MeasurementPoint[]>(() => {
    const start = this.startDate()?.toLocalNativeDate() ?? null;
    const end = this.endDate()?.toLocalNativeDate() ?? null;
    if (start) start.setHours(0, 0, 0, 0);
    if (end) end.setHours(23, 59, 59, 999);

    return this.points()
      .filter((point) => {
        const date = new Date(point.measuredAt);
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      })
      .sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());
  });

  readonly hasData = computed(() => this.filteredPoints().length > 0);

  /** Historial resuelto (más reciente primero) con la variación de cada métrica. */
  readonly rows = computed<EvolutionRowItem[]>(() => {
    const fields = this.chartFields();
    const primaryField = fields.find((def) => def.primary)?.field ?? fields[0].field;
    const sorted = [...this.filteredPoints()].reverse();

    return sorted.map((point, index) => {
      const previous = sorted[index + 1] ?? null;
      const metrics = fields
        .filter((def) => def.field === primaryField || point[def.field] != null)
        .map((def) => this.toMetric(def, point, previous));
      const primary = metrics.find((metric) => metric.field === primaryField) ?? metrics[0];

      return {
        id: `${point.measuredAt}-${index}`,
        dateLabel: this.formatLongDate(point.measuredAt),
        primary,
        metrics: metrics.filter((metric) => metric !== primary),
      };
    });
  });

  // ── Gráfica ────────────────────────────────────────────────────────────

  chartData: ChartConfiguration<'line'>['data'] | null = null;
  chartOptions: ChartConfiguration<'line'>['options'] | null = null;
  readonly chartLoaded = signal(false);

  private _canvasEl?: ElementRef<HTMLCanvasElement>;

  @ViewChild('chartCanvas') set chartCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._canvasEl = el;
    if (el) this.renderChartIfReady();
  }

  private chartInstance: Chart | null = null;

  constructor() {
    // Reconstruye la gráfica al cambiar de pestaña, de rango de fechas o de tema.
    effect(() => {
      this.themeService.colorScheme();
      this.chartType();
      const points = this.filteredPoints();
      this.buildChart(points);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  private load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.measurementService.getEvolution(tenantId, userId).subscribe({
      next: (history) => {
        const points = history?.points ?? [];
        this.points.set(points);

        if (points.length > 0) {
          const times = points.map((point) => new Date(point.measuredAt).getTime());
          this.startDate.set(TuiDay.fromLocalNativeDate(new Date(Math.min(...times))));
          this.endDate.set(TuiDay.fromLocalNativeDate(new Date(Math.max(...times))));
        }

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  setChartType(type: ChartType): void {
    this.chartType.set(type);
  }

  private toMetric(def: MetricDef, point: MeasurementPoint, previous: MeasurementPoint | null): EvolutionMetricItem {
    const value = point[def.field] ?? null;
    const previousValue = previous ? previous[def.field] ?? null : null;
    const color = seriesColor(def.field);

    const delta = value != null && previousValue != null ? value - previousValue : null;
    const isFlat = delta == null || Math.abs(delta) < 0.05;
    const improving = delta != null && (def.higherIsBetter ? delta > 0 : delta < 0);

    return {
      field: def.field,
      labelKey: def.labelKey,
      color,
      valueText: value == null ? '—' : value.toFixed(1),
      unit: value == null ? '' : def.unit,
      deltaText: isFlat ? null : `${Math.abs(delta as number).toFixed(1)}${def.unit ? ' ' + def.unit : ''}`,
      deltaClass: isFlat ? 'text-surface-400' : improving ? 'text-ok' : 'text-err',
      arrow: isFlat ? '' : (delta as number) > 0 ? '▲' : '▼',
    };
  }

  private buildChart(points: MeasurementPoint[]): void {
    if (!points || points.length === 0) {
      this.chartLoaded.set(false);
      this.destroyChart();
      return;
    }

    const type = this.chartType();
    const labels = points.map((point) =>
      new Date(point.measuredAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    );

    const selectedFields = new Set<string>(this.chartFields().map((def) => def.field));

    const unitFor = (field: string): string => {
      if (KG_FIELDS.has(field)) return ' kg';
      if (CM_FIELDS.has(field)) return ' cm';
      if (PCT_FIELDS.has(field)) return field === 'bmi' ? '' : ' %';
      return '';
    };

    const datasets = METRIC_SERIES
      .filter((series) => selectedFields.has(series.field))
      .filter((series) => points.some((point) => point[series.field] != null))
      .map((series) => ({
        label: this.transloco.translate(series.label),
        data: points.map((point) => point[series.field]),
        borderColor: series.color,
        backgroundColor: series.color,
        yAxisID: (type === 'composition' && PCT_FIELDS.has(series.field) ? 'y1' : 'y') as 'y' | 'y1',
        fill: !(type === 'composition' && PCT_FIELDS.has(series.field)),
        unit: unitFor(series.field),
      }));

    const axisTitles = type === 'composition' ? { y: 'kg', y1: '% / IMC' } : { y: 'cm' };
    const config = buildChartConfig(labels, datasets, axisTitles);

    this.chartData = config.data;
    this.chartOptions = config.options;
    this.chartLoaded.set(true);
    this.renderChartIfReady();
  }

  private renderChartIfReady(): void {
    if (!this.chartData || !this._canvasEl) return;
    this.destroyChart();
    this.chartInstance = new Chart(this._canvasEl.nativeElement, {
      type: 'line',
      data: this.chartData,
      options: this.chartOptions ?? undefined,
    });
  }

  private destroyChart(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }

  private formatLongDate(iso: string): string {
    return new Date(iso).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}

/** Color de la serie de la gráfica para un campo dado (para los puntos del historial). */
function seriesColor(field: string): string {
  return METRIC_SERIES.find((series) => series.field === field)?.color ?? '#64748b';
}
