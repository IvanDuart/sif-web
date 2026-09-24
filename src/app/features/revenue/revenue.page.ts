import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';

import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js/auto';

import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiDropdown, TuiTextfield, TuiFilterByInputPipe } from '@taiga-ui/core';
import { TuiChevron, TuiComboBox, TuiDataListWrapper, TuiTabs, TuiInputDateRange, TuiCalendarRange, TuiSegmented } from '@taiga-ui/kit';
import { TuiDay, TuiDayRange } from '@taiga-ui/cdk';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ThemeService } from '../../core/branding/theme.service';
import { buildBarChartConfig, buildChartConfig, themePrimary } from '../../shared/utils/chart-config';
import type { AppUserDto } from '../../core/api/models/user.model';
import type {
  AppointmentMetricsDto,
  MetricsGranularity,
} from '../../core/api/models/appointment.model';

Chart.register(...registerables);

type PresetKey = 'month' | 'quarter' | 'year';

const GRANULARITIES: MetricsGranularity[] = ['DAY', 'WEEK', 'MONTH', 'QUARTER'];
const MAX_BUCKETS = 60;
/** Color de la línea de objetivo: `--warn` de la Guía. */
const TARGET_COLOR = '#B5892C';

@Component({
  selector: 'app-revenue-page',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiTable,
    TuiButton, TuiDropdown, TuiTextfield, TuiFilterByInputPipe,
    TuiChevron, TuiComboBox, TuiDataListWrapper, TuiTabs, TuiInputDateRange, TuiCalendarRange,
    TuiSegmented,
  ],
  templateUrl: './revenue.page.html',
})
export default class RevenuePage implements OnInit, OnDestroy {
  private readonly appointmentService = inject(AppointmentService);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly authService = inject(AuthService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  private readonly themeService = inject(ThemeService);

  constructor() {
    effect(() => {
      // El tema (claro/oscuro) cambia los colores de los ejes y del tooltip.
      this.themeService.colorScheme();
      if (this.metrics()) {
        requestAnimationFrame(() => this.buildCharts());
      }
    });
  }

  activeTab = signal(0);
  /** Vista de la serie del periodo activo: gráfica o tabla. */
  viewMode = signal<'chart' | 'table'>('chart');

  dateRange = signal(
    new TuiDayRange(
      this.dateToTuiDay(new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1)),
      this.dateToTuiDay(new Date())
    )
  );
  granularity = signal<MetricsGranularity>('MONTH');
  granularityIndex = computed(() => GRANULARITIES.indexOf(this.granularity()));

  loading = signal(false);
  metrics = signal<AppointmentMetricsDto | null>(null);

  nutritionists = signal<AppUserDto[]>([]);
  selectedNutritionistId = signal<string | ''>('');
  nutritionistDisplay = signal('');

  currentUser = this.authService.user;

  isAdmin = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    return u.memberships?.some(m => m.permissions.includes('MANAGE_TENANT')) ?? false;
  });
  canSelectNutritionist = computed(() => this.isAdmin());

  nutritionistMap = computed(() => {
    const map = new Map<string, string>();
    map.set(this.transloco.translate('revenue.all_nutritionists'), '');
    for (const n of this.nutritionists()) {
      map.set(`${n.firstName} ${n.lastName}`, n.id);
    }
    return map;
  });

  nutritionistLabels = computed(() => {
    const labels: string[] = [];
    if (this.canSelectNutritionist()) {
      labels.push(this.transloco.translate('revenue.all_nutritionists'));
    }
    for (const n of this.nutritionists()) {
      labels.push(`${n.firstName} ${n.lastName}`);
    }
    return labels;
  });

  /** Nº de cubos que abarca el rango (sin recortar). */
  rawBucketCount = computed(() => this.countBuckets(this.dateRange(), this.granularity(), false));
  /** Nº de cubos enviado al backend, recortado al máximo admitido. */
  bucketCount = computed(() => Math.min(MAX_BUCKETS, this.rawBucketCount()));
  /** El rango abarca más cubos de los que devuelve la serie. */
  seriesCapped = computed(() => this.rawBucketCount() > MAX_BUCKETS);

  // ── Serie (para la vista de tabla) ────────────────────────────────────
  readonly revenueSeries = computed(() => this.metrics()?.series.revenue ?? []);
  readonly attendanceSeries = computed(() => this.metrics()?.series.attendanceRate ?? []);

  // ── KPIs ──────────────────────────────────────────────────────────────
  readonly revenue = computed(() => this.metrics()?.revenue ?? null);
  readonly attendance = computed(() => this.metrics()?.attendance ?? null);

  /** El backend aún no calcula huecos recuperados: la tarjeta se omite si es null. */
  readonly hasRecoveredSlots = computed(() => this.attendance()?.recoveredSlots != null);

  // ── Desgloses ─────────────────────────────────────────────────────────
  readonly byNutritionist = computed(() => this.metrics()?.byNutritionist ?? []);
  readonly byServiceType = computed(() => this.metrics()?.byServiceType ?? []);
  readonly byTimeBand = computed(() => this.metrics()?.byTimeBand ?? []);
  /** Sin `MANAGE_TENANT` el backend no expone los desgloses del centro. */
  readonly hasStaffBreakdown = computed(() => this.byNutritionist().length > 0);

  readonly maxNutritionistRevenue = computed(() =>
    Math.max(1, ...this.byNutritionist().map(n => n.revenue))
  );
  readonly maxServiceRevenue = computed(() =>
    Math.max(1, ...this.byServiceType().map(s => s.revenue))
  );

  /**
   * `scheduled` agrupa los estados SCHEDULED/COMPLETED/CANCELLED/NO_SHOW, así
   * que las citas aún sin resolver (SCHEDULED dentro del rango) no encajan en
   * ningún resultado. Se pintan como «pendientes» para que la barra cuadre con
   * la tarjeta de programadas.
   */
  readonly resolvedTotal = computed(() => {
    const a = this.attendance();
    if (!a) return 0;
    return a.attended + a.cancelledInTime + a.cancelledLate + a.noShow;
  });

  readonly outcomeTotal = computed(() => this.attendance()?.scheduled ?? 0);

  readonly pendingTotal = computed(() => Math.max(0, this.outcomeTotal() - this.resolvedTotal()));

  readonly hasOutcomes = computed(() => this.resolvedTotal() > 0);

  outcomeShare(value: number): number {
    const total = this.outcomeTotal();
    return total > 0 ? (value / total) * 100 : 0;
  }

  /** Color de la barra de una franja horaria según su tasa (Guía §6). */
  bandTone(rate: number): string {
    if (rate < 0.8) return 'bg-err';
    if (rate < 0.9) return 'bg-warn';
    return 'bg-primary-500';
  }

  // ── Charts ────────────────────────────────────────────────────────────
  private revenueChart: Chart | null = null;
  private attendanceChart: Chart | null = null;
  private revenueChartConfig: ChartConfiguration<'bar'> | null = null;
  private attendanceChartConfig: ChartConfiguration<'line'> | null = null;

  private _revenueCanvasEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueCanvas') set revenueCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._revenueCanvasEl = el;
    if (el) {
      this.renderRevenueChart();
    } else {
      this.revenueChart?.destroy();
      this.revenueChart = null;
    }
  }

  private _attendanceCanvasEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('attendanceCanvas') set attendanceCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._attendanceCanvasEl = el;
    if (el) {
      this.renderAttendanceChart();
    } else {
      this.attendanceChart?.destroy();
      this.attendanceChart = null;
    }
  }

  ngOnInit(): void {
    const user = this.currentUser();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !user) return;

    if (!this.canSelectNutritionist()) {
      this.selectedNutritionistId.set(user.id);
      this.nutritionistDisplay.set(`${user.firstName} ${user.lastName}`);
    }

    this.loadNutritionists(tenantId);
    this.loadData();
  }

  private loadNutritionists(tenantId: string): void {
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 1000 }).subscribe({
      next: (res) => this.nutritionists.set(res.content || []),
    });
  }

  setGranularity(index: number): void {
    const g = GRANULARITIES[index] ?? 'MONTH';
    if (g === this.granularity()) return;
    this.granularity.set(g);
    this.loadData();
  }

  setViewMode(index: number): void {
    this.viewMode.set(index === 1 ? 'table' : 'chart');
  }

  applyPreset(label: PresetKey): void {
    const now = new Date();
    let start: Date;
    let granularity: MetricsGranularity;

    switch (label) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        granularity = 'MONTH';
        break;
      case 'quarter':
      case 'year': {
        // Alinear al inicio de trimestre para que el rango cubra cubos enteros:
        // 8 trimestres (2 años) o 16 (4 años).
        const quartersBack = label === 'quarter' ? 7 : 15;
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStartMonth - quartersBack * 3, 1);
        granularity = 'QUARTER';
        break;
      }
      default:
        return;
    }

    this.granularity.set(granularity);
    this.dateRange.set(new TuiDayRange(this.dateToTuiDay(start), this.dateToTuiDay(now)));
    this.loadData();
  }

  loadData(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const range = this.dateRange();
    if (!range?.from || !range?.to) return;

    this.loading.set(true);
    const nutritionistId = this.canSelectNutritionist() ? (this.selectedNutritionistId() || undefined) : undefined;

    this.appointmentService.getMetrics(tenantId, {
      from: this.dayStartIso(range.from),
      to: this.dayEndIso(range.to),
      nutritionistId,
      granularity: this.granularity(),
      bucketCount: this.bucketCount(),
    }).pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.metrics.set(res);
          this.buildCharts();
        },
        error: () => this.metrics.set(null),
      });
  }

  onNutritionistChange(label: string): void {
    this.nutritionistDisplay.set(label);
    this.selectedNutritionistId.set(this.nutritionistMap().get(label) || '');
    this.loadData();
  }

  onDateChange(): void {
    this.loadData();
  }

  // ── Formato ───────────────────────────────────────────────────────────
  formatEUR(value: number): string {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatNumber(value: number): string {
    return new Intl.NumberFormat('es-ES').format(value);
  }

  formatPercent(value: number, digits = 1): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'percent',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  }

  // ── Charts ────────────────────────────────────────────────────────────
  private buildCharts(): void {
    const m = this.metrics();
    if (!m) {
      this.revenueChartConfig = null;
      this.attendanceChartConfig = null;
      return;
    }

    const revenueLabels = m.series.revenue.map(p => p.label);
    this.revenueChartConfig = buildBarChartConfig(
      revenueLabels,
      {
        label: this.transloco.translate('revenue.series_revenue'),
        data: m.series.revenue.map(p => p.value),
        color: themePrimary(),
        highlightLast: true,
      },
      { y: this.transloco.translate('revenue.amount') }
    );

    const attendanceLabels = m.series.attendanceRate.map(p => p.label);
    const target = m.attendance.targetRate;
    this.attendanceChartConfig = buildChartConfig(
      attendanceLabels,
      [
        {
          label: this.transloco.translate('revenue.series_attendance'),
          data: m.series.attendanceRate.map(p => this.toPercentValue(p.value)),
          borderColor: themePrimary(),
          backgroundColor: themePrimary(),
          unit: ' %',
        },
        {
          label: this.transloco.translate('revenue.series_target'),
          data: attendanceLabels.map(() => this.toPercentValue(target)),
          borderColor: TARGET_COLOR,
          backgroundColor: TARGET_COLOR,
          fill: false,
          borderDash: [6, 4],
          pointRadius: 0,
          unit: ' %',
        },
      ],
      { y: this.transloco.translate('revenue.percent') }
    );

    this.renderRevenueChart();
    this.renderAttendanceChart();
  }

  private renderRevenueChart(): void {
    if (!this.revenueChartConfig || !this._revenueCanvasEl) return;
    this.revenueChart?.destroy();
    this.revenueChart = new Chart(this._revenueCanvasEl.nativeElement, this.revenueChartConfig);
  }

  private renderAttendanceChart(): void {
    if (!this.attendanceChartConfig || !this._attendanceCanvasEl) return;
    this.attendanceChart?.destroy();
    this.attendanceChart = new Chart(this._attendanceCanvasEl.nativeElement, this.attendanceChartConfig);
  }

  private toPercentValue(rate: number): number {
    return Math.round(rate * 1000) / 10;
  }

  // ── Fechas ────────────────────────────────────────────────────────────
  private countBuckets(range: TuiDayRange | null, granularity: MetricsGranularity, cap = true): number {
    if (!range?.from || !range?.to) return 1;

    const start = new Date(range.from.year, range.from.month, range.from.day);
    const end = new Date(range.to.year, range.to.month, range.to.day);
    if (start > end) return 1;

    const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

    let count: number;
    switch (granularity) {
      case 'DAY':
        count = diffDays;
        break;
      case 'WEEK':
        count = Math.ceil(diffDays / 7);
        break;
      case 'QUARTER':
        count = Math.ceil(diffMonths / 3);
        break;
      default:
        count = diffMonths;
    }

    return cap ? Math.min(MAX_BUCKETS, Math.max(1, count)) : Math.max(1, count);
  }

  private dayStartIso(day: TuiDay): string {
    return new Date(day.year, day.month, day.day, 0, 0, 0, 0).toISOString();
  }

  private dayEndIso(day: TuiDay): string {
    return new Date(day.year, day.month, day.day, 23, 59, 59, 999).toISOString();
  }

  private dateToTuiDay(date: Date): TuiDay {
    return new TuiDay(date.getFullYear(), date.getMonth(), date.getDate());
  }

  ngOnDestroy(): void {
    this.revenueChart?.destroy();
    this.attendanceChart?.destroy();
  }
}
