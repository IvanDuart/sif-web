import { Component, DestroyRef, OnInit, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import { ExchangeService } from '../../../core/api/services/exchange.api';
import { ExchangeGroupDto } from '../../../core/api/models/exchange.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { MascotFillService } from '../../assistant/mascot/fill/mascot-fill.service';
import { exchangeKeys, exchangesAccess, mealExchangesSurface } from '../../assistant/mascot/fill/surfaces/meal-exchanges.surface';

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
export class MealExchangesEditor implements OnInit {
  private readonly exchangeService = inject(ExchangeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  mealId = input.required<string>();
  canManage = input(false);
  /**
   * Si la mascota puede rellenarlo. La página monta el editor dos veces (la
   * rejilla de escritorio y la lista del móvil, una oculta por CSS): sólo una
   * se apunta, o la mascota podría escribir en la que no se ve.
   */
  mascot = input(true);
  saved = output<void>();

  readonly rows = signal<ExchangeRow[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  /** Evita recargar el editor tras cada guardado propio. */
  private loadedMealId: string | null = null;

  private readonly fill = inject(MascotFillService);
  private readonly destroyRef = inject(DestroyRef);

  /** La clave de cada grupo para la mascota, para anclar su campo en la plantilla. */
  protected keyOf(groupId: string): string {
    return exchangeKeys(this.rows().map((row) => row.group)).get(groupId) ?? '';
  }

  ngOnInit(): void {
    if (!this.mascot() || !this.canManage()) return;
    const groups = () => this.rows().map((row) => row.group);
    this.fill.register(
      mealExchangesSurface({
        groups,
        ready: () => !this.loading() && this.rows().length > 0,
        mealId: () => (this.loading() ? null : this.loadedMealId),
      }),
      exchangesAccess({
        groups,
        get: (groupId) => this.rows().find((row) => row.group.id === groupId)?.targetRations ?? null,
        set: (groupId, value) =>
          this.rows.update((rows) =>
            rows.map((row) => (row.group.id === groupId ? { ...row, targetRations: value } : row)),
          ),
      }),
      this.destroyRef,
    );
  }

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
