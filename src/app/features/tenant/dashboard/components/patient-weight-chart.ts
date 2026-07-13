import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { BodyMeasurementService } from '../../../../core/api/services/body-measurement.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MeasurementHistoryDto, MeasurementPoint } from '../../../../core/api/models/body-measurement.model';
import { buildChartConfig } from '../../../../shared/utils/chart-config';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-patient-weight-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="data-card border border-surface-200 dark:border-surface-700 flex flex-col h-full">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-chart-line text-primary-500 text-xl"></i>
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
            {{ t('patient_dashboard.weight_evolution', { defaultValue: 'Evolución de Peso' }) }}
          </h3>
        </div>

        <!-- Date filters -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center gap-1">
            <span class="text-xs text-surface-500">{{ t('common.from', { defaultValue: 'Desde' }) }}</span>
            <input
              type="date"
              [(ngModel)]="startDate"
              (change)="filterAndRenderChart()"
              class="rounded-lg border border-surface-300 dark:border-surface-700 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div class="flex items-center gap-1">
            <span class="text-xs text-surface-500">{{ t('common.to', { defaultValue: 'Hasta' }) }}</span>
            <input
              type="date"
              [(ngModel)]="endDate"
              (change)="filterAndRenderChart()"
              class="rounded-lg border border-surface-300 dark:border-surface-700 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center py-12">
          <i class="fa-solid fa-spinner fa-spin text-primary-500 text-2xl"></i>
        </div>
      } @else if (hasData()) {
        <div class="flex-1 min-h-[250px] relative">
          <canvas #chartCanvas></canvas>
        </div>
      } @else {
        <div class="flex-1 flex flex-col items-center justify-center text-center py-12 text-surface-400">
          <i class="fa-solid fa-chart-area text-3xl mb-2 text-surface-300"></i>
          <p class="text-sm">
            {{ t('patient_dashboard.no_weight_history', { defaultValue: 'No hay datos de evolución de peso registrados' }) }}
          </p>
        </div>
      }
    </div>
  `
})
export class PatientWeightChart implements OnInit, OnDestroy {
  private readonly measurementService = inject(BodyMeasurementService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  @ViewChild('chartCanvas') chartCanvasEl?: ElementRef<HTMLCanvasElement>;

  loading = signal(false);
  hasData = signal(false);
  startDate = '';
  endDate = '';

  private chartInstance: Chart | null = null;
  private rawPoints: MeasurementPoint[] = [];

  ngOnInit() {
    this.loadWeightHistory();
  }

  ngOnDestroy() {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  loadWeightHistory() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.measurementService.getEvolution(tenantId, userId).subscribe({
      next: (history) => {
        this.rawPoints = history?.points || [];
        this.loading.set(false);

        if (this.rawPoints.length > 0) {
          this.hasData.set(true);

          // Find date range
          const sortedDates = [...this.rawPoints].map(p => new Date(p.measuredAt).getTime()).sort((a, b) => a - b);
          const firstDate = new Date(sortedDates[0]);
          const lastDate = new Date(sortedDates[sortedDates.length - 1]);

          const format = (d: Date) => d.toISOString().split('T')[0];
          this.startDate = format(firstDate);
          this.endDate = format(lastDate);

          // Render chart after view initializes
          setTimeout(() => this.filterAndRenderChart(), 50);
        } else {
          this.hasData.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.hasData.set(false);
      }
    });
  }

  filterAndRenderChart() {
    if (!this.chartCanvasEl || this.rawPoints.length === 0) return;

    const start = this.startDate ? new Date(this.startDate + 'T00:00:00') : null;
    const end = this.endDate ? new Date(this.endDate + 'T23:59:59') : null;

    // Filter points between startDate and endDate
    let filtered = this.rawPoints.filter(p => {
      const d = new Date(p.measuredAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

    // Chart.js expects chronologically ascending order (oldest to newest)
    // Points from the API are usually descending, let's sort ascending by date
    filtered = [...filtered].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime());

    if (filtered.length === 0) {
      if (this.chartInstance) {
        this.chartInstance.destroy();
        this.chartInstance = null;
      }
      return;
    }

    const labels = filtered.map(p => {
      const d = new Date(p.measuredAt);
      return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    });

    const weightData = filtered.map(p => p.weightKg);

    const datasets = [
      {
        label: this.transloco.translate('measurements.series.weight', { defaultValue: 'Peso (Kg)' }),
        data: weightData,
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }
    ];

    const config = buildChartConfig(labels, datasets);

    if (this.chartInstance) {
      this.chartInstance.destroy();
    }

    this.chartInstance = new Chart(this.chartCanvasEl.nativeElement, {
      type: 'line',
      data: config.data,
      options: config.options ?? undefined
    });
  }
}
