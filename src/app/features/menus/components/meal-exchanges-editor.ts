import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import { ExchangeService } from '../../../core/api/services/exchange.api';
import { ExchangeGroupDto } from '../../../core/api/models/exchange.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';

interface ExchangeRow {
  group: ExchangeGroupDto;
  targetRations: number | null;
}

/**
 * Planificador por raciones de una comida. Sólo se monta cuando el centro tiene
 * `exchangeGroupsEnabled`; al guardar se envían las raciones objetivo y el
 * backend reescribe los gramos de los ingredientes (`syncItems = true`).
 */
@Component({
  selector: 'app-meal-exchanges-editor',
  standalone: true,
  imports: [FormsModule, TranslocoDirective, TuiButton],
  templateUrl: './meal-exchanges-editor.html',
})
export class MealExchangesEditor {
  private readonly exchangeService = inject(ExchangeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  mealId = input.required<string>();
  canManage = input(false);
  saved = output<void>();

  readonly rows = signal<ExchangeRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  /** Evita recargar el editor tras cada guardado propio. */
  private loadedMealId: string | null = null;

  constructor() {
    effect(() => {
      const mealId = this.mealId();
      if (!mealId || mealId === this.loadedMealId) return;
      this.load(mealId);
    });
  }

  private load(mealId: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loadedMealId = mealId;
    this.loading.set(true);

    this.exchangeService.listGroups(tenantId).subscribe({
      next: (groups) => {
        this.exchangeService.getMealExchanges(tenantId, mealId).subscribe({
          next: (exchanges) => {
            const targets = new Map(exchanges.map((exchange) => [exchange.groupId, exchange.targetRations]));
            this.rows.set(
              (groups ?? []).map((group) => ({
                group,
                targetRations: targets.get(group.id) ?? null,
              }))
            );
            this.loading.set(false);
          },
          error: () => {
            this.rows.set((groups ?? []).map((group) => ({ group, targetRations: null })));
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      },
    });
  }

  save(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const mealId = this.mealId();
    if (!tenantId || !mealId) return;

    const exchanges = this.rows()
      .filter((row) => (row.targetRations ?? 0) > 0)
      .map((row) => ({
        groupId: row.group.id,
        targetRations: row.targetRations as number,
      }));

    this.saving.set(true);
    this.exchangeService.setMealExchanges(tenantId, mealId, { exchanges, syncItems: true }, true).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.success(this.transloco.translate('diet_detail.exchanges.saved'));
        this.saved.emit();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('diet_detail.exchanges.save_error'));
      },
    });
  }
}
