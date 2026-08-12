import { Component, OnInit, OnDestroy, ViewChild, ElementRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { BodyMeasurementService } from '../../../../core/api/services/body-measurement.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MeasurementPoint } from '../../../../core/api/models/body-measurement.model';
import { buildChartConfig, hexToRgba, themePrimary } from '../../../../shared/utils/chart-config';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

@Component({
  selector: 'app-patient-weight-chart',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective],
  templateUrl: './patient-weight-chart.html'
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

          const sortedDates = [...this.rawPoints].map(p => new Date(p.measuredAt).getTime()).sort((a, b) => a - b);
          const firstDate = new Date(sortedDates[0]);
          const lastDate = new Date(sortedDates[sortedDates.length - 1]);

          const format = (d: Date) => d.toISOString().split('T')[0];
          this.startDate = format(firstDate);
          this.endDate = format(lastDate);

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

    let filtered = this.rawPoints.filter(p => {
      const d = new Date(p.measuredAt);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
    });

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
        borderColor: themePrimary(),
        backgroundColor: hexToRgba(themePrimary(), 0.1),
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
