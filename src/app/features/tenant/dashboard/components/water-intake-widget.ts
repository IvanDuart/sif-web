import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WaterIntakeService } from '../../../../core/api/services/water-intake.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { WaterIntakeDto } from '../../../../core/api/models/water-intake.model';
import { NotificationService } from '../../../../core/ui';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';

@Component({
  selector: 'app-water-intake-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective, TuiButton, TuiInput, TuiTextfield],
  templateUrl: './water-intake-widget.html'
})
export class WaterIntakeWidget implements OnInit {
  @Input() patientId!: string;

  private readonly waterService = inject(WaterIntakeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly circumference = 2 * Math.PI * 64; // r=64 -> 402.12

  loading = signal(false);
  history = signal<WaterIntakeDto[]>([]);
  todayAmount = signal(0);
  isGoalReached = computed(() => this.todayAmount() >= 2000);
  remainingAmount = computed(() => Math.max(0, 2000 - this.todayAmount()));

  customAmount: number | null = null;

  canManage = computed(() => {
    return this.authService.user()?.id === this.patientId;
  });

  get strokeDashoffset(): number {
    const percent = Math.min(100, (this.todayAmount() / 2000) * 100);
    return this.circumference - (percent / 100) * this.circumference;
  }

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.patientId) return;

    this.loading.set(true);
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);

    const format = (d: Date) => d.toISOString().split('T')[0];

    this.waterService.getHistory(tenantId, this.patientId, format(start), format(today)).subscribe({
      next: (res) => {
        const sorted = (res || []).sort((a, b) => b.recordDate.localeCompare(a.recordDate));
        this.history.set(sorted);

        const todayStr = format(new Date());
        const todayRecord = sorted.find(r => r.recordDate === todayStr);
        this.todayAmount.set(todayRecord?.amountMl || 0);

        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  addWater(amount: number) {
    this.updateTodayWater(this.todayAmount() + amount);
  }

  logCustomWater() {
    if (this.customAmount == null || this.customAmount <= 0) return;
    this.addWater(this.customAmount);
    this.customAmount = null;
  }

  private updateTodayWater(newAmount: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    const todayStr = new Date().toISOString().split('T')[0];

    this.waterService.update(tenantId, userId, todayStr, { amountMl: newAmount }).subscribe({
      next: () => {
        this.loadData();
      },
      error: () => {
        this.notify.error(this.transloco.translate('water_intake.log_error'));
      }
    });
  }

  deleteRecord(record: WaterIntakeDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.waterService.delete(tenantId, userId, record.id).subscribe({
      next: () => {
        this.loadData();
      },
      error: () => {
        this.notify.error(this.transloco.translate('water_intake.delete_error'));
      }
    });
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.getTime() === today.getTime()) {
      return this.transloco.translate('water_intake.today');
    } else if (d.getTime() === yesterday.getTime()) {
      return this.transloco.translate('water_intake.yesterday');
    }

    return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric' });
  }
}
