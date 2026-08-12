import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, OnDestroy, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiDropdown, TuiTextfield, TuiFilterByInputPipe } from '@taiga-ui/core';
import {TuiChevron, TuiComboBox, TuiDataListWrapper, TuiTabs, TuiInputDateRange, TuiCalendarRange} from '@taiga-ui/kit';
import { TuiDay, TuiDayRange } from '@taiga-ui/cdk';

import { Chart, registerables } from 'chart.js';
import type { ChartConfiguration } from 'chart.js/auto';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { NotificationService } from '../../core/ui';
import { ThemeService } from '../../core/branding/theme.service';
import { buildChartConfig, themePrimary } from '../../shared/utils/chart-config';
import type { AppUserDto } from '../../core/api/models/user.model';

Chart.register(...registerables);

type Granularity = 'day' | 'week' | 'month';
type ViewMode = 'chart' | 'table';

interface Bucket {
  label: string;
  start: string;
  end: string;
}

const MAX_BUCKETS = 60;

@Component({
  selector: 'app-revenue-page',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiTable,
    TuiButton, TuiDropdown, TuiTextfield, TuiFilterByInputPipe,
    TuiChevron, TuiComboBox, TuiDataListWrapper, TuiTabs, TuiInputDateRange, TuiCalendarRange,
  ],
  templateUrl: './revenue.page.html',
})
export default class RevenuePage implements OnInit, OnDestroy {
  private readonly appointmentService = inject(AppointmentService);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly authService = inject(AuthService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  readonly permissionsService = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly themeService = inject(ThemeService);

  dateRange = signal(
    new TuiDayRange(
      this.dateToTuiDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      this.dateToTuiDay(new Date())
    )
  );
  granularity = signal<Granularity>('month');
  viewMode = signal<ViewMode>('chart');

  loading = signal(false);
  nutritionists = signal<AppUserDto[]>([]);
  selectedNutritionistId = signal<string | ''>('');

  nutritionistMap = computed(() => {
    const map = new Map<string, string>();
    const allLabel = this.transloco.translate('revenue.all_nutritionists');
    map.set(allLabel, '');
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

  nutritionistDisplay = signal('');

  revenueData = signal<{ label: string; value: number }[]>([]);

  // Chart
  chartData: ChartConfiguration<'line'>['data'] | null = null;
  chartOptions: ChartConfiguration<'line'>['options'] | null = null;
  chartLoaded = signal(false);
  private _chartCanvasEl?: ElementRef<HTMLCanvasElement>;
  @ViewChild('chartCanvas') set chartCanvasEl(el: ElementRef<HTMLCanvasElement> | undefined) {
    this._chartCanvasEl = el;
    if (el) this.renderChartIfReady();
  }
  private chartInstance: Chart | null = null;

  currentUser = this.authService.user;

  isAdmin = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    return u.memberships?.some(m => m.permissions.includes('MANAGE_TENANT')) ?? false;
  });

  isNutritionist = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    return u.memberships?.some(m => m.permissions.includes('VIEW_REVENUE')) ?? false;
  });

  canSelectNutritionist = computed(() => this.isAdmin());
  nutritionistLocked = computed(() => !this.canSelectNutritionist());

  buckets = computed(() => this.computeBuckets(this.dateRange(), this.granularity()));
  bucketCount = computed(() => this.buckets().length);
  totalRevenue = computed(() => this.revenueData().reduce((acc, d) => acc + d.value, 0));
  averageRevenue = computed(() => {
    const count = this.bucketCount();
    return count > 0 ? this.totalRevenue() / count : 0;
  });

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

    effect(() => {
      this.themeService.colorScheme();
      if (this.chartLoaded()) {
        requestAnimationFrame(() => this.buildChart());
      }
    });
  }

  private loadNutritionists(tenantId: string): void {
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 1000 }).subscribe({
      next: (res) => this.nutritionists.set(res.content || []),
    });
  }

  setGranularity(g: Granularity): void {
    this.granularity.set(g);
    this.loadData();
  }

  setViewMode(m: ViewMode): void {
    this.viewMode.set(m);
  }

  applyPreset(label: string): void {
    const now = new Date();
    let start: Date;
    let end: Date;

    switch (label) {
      case 'this_month': {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      }
      case 'last_month': {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      }
      case 'quarter': {
        start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        end = now;
        break;
      }
      case 'year': {
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      }
      case 'last_12m': {
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        end = now;
        break;
      }
      default: return;
    }

    this.dateRange.set(new TuiDayRange(this.dateToTuiDay(start), this.dateToTuiDay(end)));
    this.loadData();
  }

  loadData(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const buckets = this.buckets();
    if (buckets.length === 0) {
      this.revenueData.set([]);
      return;
    }

    this.loading.set(true);
    const nutritionistId = this.selectedNutritionistId() || undefined;

    forkJoin(
      buckets.map(b =>
        this.appointmentService.getRevenue(tenantId, b.start, b.end, nutritionistId).pipe(
          catchError(() => of(0))
        )
      )
    ).pipe(finalize(() => this.loading.set(false)))
      .subscribe(results => {
        this.revenueData.set(
          buckets.map((b, i) => ({ label: b.label, value: results[i] ?? 0 }))
        );
        this.buildChart();
      });
  }

  formatEUR(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(value);
  }

  granularityIndex = signal(0);

  viewModeIndex = signal(0);

  onNutritionistChange(label: string): void {
    this.nutritionistDisplay.set(label);
    const id = this.nutritionistMap().get(label) || '';
    this.selectedNutritionistId.set(id);
    this.loadData();
  }

  onGranularityChange(index: number): void {
    this.granularityIndex.set(index);
    const map: Granularity[] = ['month', 'week', 'day'];
    this.granularity.set(map[index] ?? 'month');
    this.loadData();
  }

  onDateChange(): void {
    this.loadData();
  }

  nutritionistTrackBy(_: number, n: AppUserDto): string {
    return n.id;
  }

  private computeBuckets(dateRange: TuiDayRange | null, granularity: Granularity): Bucket[] {
    if (!dateRange || !dateRange.from || !dateRange.to) return [];

    const startDay = dateRange.from;
    const endDay = dateRange.to;

    // Construct dates securely: at 00:00:00 for start, 23:59:59 for end
    const start = new Date(startDay.year, startDay.month, startDay.day, 0, 0, 0);
    const end = new Date(endDay.year, endDay.month, endDay.day, 23, 59, 59);

    if (start > end) return [];

    const buckets: Bucket[] = [];
    const current = new Date(start);

    let granularityFinal = granularity;
    let estimated: number;

    let shouldContinue = true;
    while (shouldContinue) {
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (granularityFinal === 'day') estimated = diffDays + 1;
      else if (granularityFinal === 'week') estimated = Math.ceil((diffDays + 1) / 7);
      else estimated = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;

      if (estimated > MAX_BUCKETS && granularityFinal === 'day') {
        granularityFinal = 'week';
      } else if (estimated > MAX_BUCKETS && granularityFinal === 'week') {
        granularityFinal = 'month';
      } else {
        shouldContinue = false;
      }
    }

    while (current <= end) {
      let bucketStart: Date;
      let bucketEnd: Date;
      let label: string;

      if (granularityFinal === 'day') {
        bucketStart = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 0, 0, 0);
        bucketEnd = new Date(current.getFullYear(), current.getMonth(), current.getDate(), 23, 59, 59);
        label = current.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        current.setDate(current.getDate() + 1);
      } else if (granularityFinal === 'week') {
        const dayOfWeek = current.getDay();
        bucketStart = new Date(current);
        bucketStart.setDate(current.getDate() - dayOfWeek);
        bucketStart.setHours(0, 0, 0, 0);
        bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketStart.getDate() + 6);
        bucketEnd.setHours(23, 59, 59, 999);
        const weekStart = bucketStart.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
        label = weekStart;
        current.setDate(current.getDate() + 7);
      } else {
        bucketStart = new Date(current.getFullYear(), current.getMonth(), 1, 0, 0, 0);
        bucketEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59);
        label = current.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        current.setMonth(current.getMonth() + 1);
      }

      if (bucketStart > end) break;

      const bStart = bucketStart < start ? new Date(start) : bucketStart;
      const bEnd = bucketEnd > end ? new Date(end) : bucketEnd;

      buckets.push({
        label,
        start: bStart.toISOString(),
        end: bEnd.toISOString(),
      });
    }

    return buckets;
  }

  private toDateInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private dateToTuiDay(date: Date): TuiDay {
    return new TuiDay(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private tuiDayToString(day: TuiDay | null): string {
    if (!day) return '';
    const y = day.year;
    const m = String(day.month + 1).padStart(2, '0');
    const d = String(day.day).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildChart(): void {
    const data = this.revenueData();
    if (!data || data.length === 0) {
      this.chartLoaded.set(false);
      return;
    }

    const labels = data.map(d => d.label);
    const values = data.map(d => d.value);

    const config = buildChartConfig(
      labels,
      [{
        label: this.transloco.translate('revenue.title'),
        data: values,
        borderColor: themePrimary(),
        backgroundColor: themePrimary(),
      }]
    );

    if (config.options?.plugins?.legend) {
      config.options.plugins.legend.display = false;
    }

    this.chartData = config.data;
    this.chartOptions = config.options;
    this.chartLoaded.set(true);
    this.renderChartIfReady();
  }

  private renderChartIfReady(): void {
    if (!this.chartData || !this._chartCanvasEl) return;
    if (this.chartInstance) this.chartInstance.destroy();
    this.chartInstance = new Chart(this._chartCanvasEl.nativeElement, {
      type: 'line',
      data: this.chartData,
      options: this.chartOptions ?? undefined,
    });
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }
  }
}
