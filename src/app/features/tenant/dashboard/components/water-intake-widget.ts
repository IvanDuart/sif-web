import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { WaterIntakeService } from '../../../../core/api/services/water-intake.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { WaterIntakeDto } from '../../../../core/api/models/water-intake.model';
import { NotificationService } from '../../../../core/ui';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'app-water-intake-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective, TuiButton],
  template: `
    <div *transloco="let t" class="data-card border border-surface-200 dark:border-surface-700 flex flex-col h-full">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-droplet text-blue-500 text-xl"></i>
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
            {{ t('water_intake.title', { defaultValue: 'Consumo de Agua' }) }}
          </h3>
        </div>
        <span class="text-xs text-surface-500 font-medium">
          {{ t('water_intake.goal_desc', { defaultValue: 'Objetivo: 2L al día' }) }}
        </span>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center py-8">
          <i class="fa-solid fa-spinner fa-spin text-primary-500 text-2xl"></i>
        </div>
      } @else {
        <!-- Main: Today's Intake -->
        <div class="flex flex-col items-center justify-center mb-6 py-2">
          <div class="relative w-36 h-36 flex items-center justify-center">
            <!-- Semi-circle or progress background -->
            <svg class="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke-width="10"
                stroke="currentColor"
                class="text-surface-100 dark:text-surface-800"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="64"
                stroke-width="10"
                stroke="currentColor"
                class="text-blue-500 transition-all duration-500"
                fill="transparent"
                [attr.stroke-dasharray]="circumference"
                [attr.stroke-dashoffset]="strokeDashoffset"
              />
            </svg>
            <div class="absolute flex flex-col items-center justify-center text-center">
              <span class="text-3xl font-extrabold text-surface-900 dark:text-surface-0">
                {{ todayAmount() }}
              </span>
              <span class="text-xs font-semibold text-surface-500">
                ml / 2000 ml
              </span>
            </div>
          </div>

          <!-- Goal feedback badge -->
          @if (isGoalReached()) {
            <span class="mt-4 px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 flex items-center gap-1.5 animate-bounce">
              <i class="fa-solid fa-circle-check"></i>
              {{ t('water_intake.goal_reached', { defaultValue: '¡Meta alcanzada!' }) }}
            </span>
          } @else {
            <span class="mt-4 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
              {{ t('water_intake.remaining', { defaultValue: 'Restan {amount} ml', amount: remainingAmount() }) }}
            </span>
          }
        </div>

        <!-- Interactive Logging: Patient Only -->
        @if (canManage()) {
          <div class="flex flex-col gap-3 mb-6">
            <div class="flex gap-2">
              <button tuiButton appearance="outline" size="s" (click)="addWater(250)" class="flex-1">
                <i class="fa-solid fa-plus text-xs"></i> 250ml
              </button>
              <button tuiButton appearance="outline" size="s" (click)="addWater(500)" class="flex-1">
                <i class="fa-solid fa-plus text-xs"></i> 500ml
              </button>
              <button tuiButton appearance="outline" size="s" (click)="addWater(1000)" class="flex-1">
                <i class="fa-solid fa-plus text-xs"></i> 1L
              </button>
            </div>
            
            <div class="flex gap-2 items-center">
              <input
                type="number"
                [placeholder]="t('water_intake.custom_placeholder')"
                [(ngModel)]="customAmount"
                min="0"
                class="flex-1 rounded-lg border border-surface-300 dark:border-surface-700 bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button tuiButton size="s" (click)="logCustomWater()" class="text-sm font-medium">
                {{ t('common.add', { defaultValue: 'Añadir' }) }}
              </button>
            </div>
          </div>
        }

        <!-- Weekly History -->
        <div class="flex-1 flex flex-col justify-end">
          <h4 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">
            {{ t('water_intake.history_title', { defaultValue: 'Últimos 7 días' }) }}
          </h4>
          <div class="space-y-2 overflow-y-auto max-h-[220px]">
            @for (item of history(); track item.recordDate) {
              <div class="flex items-center justify-between p-2 rounded-lg bg-surface-50 dark:bg-surface-800 text-sm">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-circle text-xs" [class.text-green-500]="item.isGoalReached" [class.text-blue-300]="!item.isGoalReached"></i>
                  <span class="font-medium text-surface-700 dark:text-surface-300">
                    {{ formatDate(item.recordDate) }}
                  </span>
                </div>
                <div class="flex items-center gap-3">
                  <span class="font-semibold text-surface-900 dark:text-surface-0">
                    {{ item.amountMl }} ml
                  </span>
                  @if (canManage()) {
                    <button (click)="deleteRecord(item)" class="text-surface-400 hover:text-red-500 transition-colors p-1" [title]="t('common.delete')">
                      <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  }
                </div>
              </div>
            } @empty {
              <p class="text-xs text-surface-400 text-center py-4">
                {{ t('water_intake.no_history', { defaultValue: 'Sin registros esta semana.' }) }}
              </p>
            }
          </div>
        </div>
      }
    </div>
  `
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
    // Get last 7 days
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 6);

    const format = (d: Date) => d.toISOString().split('T')[0];

    this.waterService.getHistory(tenantId, this.patientId, format(start), format(today)).subscribe({
      next: (res) => {
        // Sort descending by date
        const sorted = (res || []).sort((a, b) => b.recordDate.localeCompare(a.recordDate));
        this.history.set(sorted);

        // Find today's record
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
