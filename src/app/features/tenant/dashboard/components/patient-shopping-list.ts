import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { MenuService } from '../../../../core/api/services/menu.api';
import { ShoppingListService } from '../../../../core/api/services/shopping-list.api';
import { ShoppingListDto, ShoppingListItemDto } from '../../../../core/api/models/shopping-list.model';

const SUPERMARKET_LABELS: Record<string, string> = {
  MERCADONA: 'Mercadona',
  CARREFOUR: 'Carrefour',
  LIDL: 'Lidl',
  ALCAMPO: 'Alcampo',
  DIA: 'Dia',
  EL_CORTE_INGLES: 'El Corte Inglés',
  ALDI: 'Aldi',
  EROSKI: 'Eroski',
  CONSUM: 'Consum',
  HIPERCOR: 'Hipercor',
  MASYMAS: 'Mas y Mas',
};

@Component({
  selector: 'app-patient-shopping-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="data-card border border-surface-200 dark:border-surface-700 flex flex-col h-full">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-cart-shopping text-primary-500 text-xl"></i>
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
            {{ t('patient_dashboard.shopping_list', {defaultValue: 'Lista de la Compra'}) }}
          </h3>
        </div>
        @if (shoppingList(); as list) {
          <span class="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs font-bold px-2 py-0.5 rounded">
            {{ supermarketLabel(list.supermarket) }}
          </span>
        }
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center py-6">
          <i class="fa-solid fa-spinner fa-spin text-primary-500 text-xl"></i>
        </div>
      } @else if (shoppingList(); as list) {
        <div class="space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-1">
          @for (group of groupedItems(); track group.category) {
            <div>
              <h4 class="text-xs font-bold text-surface-500 uppercase tracking-wider mb-2">{{ group.category }}</h4>
              <div class="space-y-1">
                @for (item of group.items; track item.id) {
                  <label class="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      [ngModel]="item.checked"
                      (ngModelChange)="toggleItem(item, $event)"
                      class="w-4 h-4 rounded border-surface-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <div class="flex-1 min-w-0">
                      <span [class.line-through]="item.checked" [class.text-surface-400]="item.checked" class="text-sm font-medium text-surface-900 dark:text-surface-0">
                        {{ item.name }}
                      </span>
                      @if (item.quantity) {
                        <span class="text-xs text-surface-400 ml-1">
                          {{ item.quantity }}{{ item.unit ? ' ' + item.unit : '' }}
                        </span>
                      }
                      @if (item.notes) {
                        <p class="text-xs text-surface-400 truncate">{{ item.notes }}</p>
                      }
                    </div>
                    @if (item.estimatedPrice) {
                      <span class="text-xs font-medium text-surface-500 whitespace-nowrap">{{ item.estimatedPrice.toFixed(2) }} €</span>
                    }
                  </label>
                }
              </div>
            </div>
          }
          <div class="flex items-center justify-between pt-2 border-t border-surface-200 dark:border-surface-700">
            <span class="text-xs text-surface-500">{{ t('shopping_list.total_items', {defaultValue: 'Total'}) }}: {{ list.items.length }}</span>
            <span class="text-sm font-bold text-primary-600">{{ totalPrice() }} €</span>
          </div>
        </div>
      } @else {
        <div class="flex-1 flex flex-col items-center justify-center py-6 text-surface-400">
          <i class="fa-solid fa-cart-shopping text-3xl mb-2 opacity-50"></i>
          <p class="text-sm">{{ t('patient_dashboard.no_shopping_list', {defaultValue: 'No hay lista de la compra activa'}) }}</p>
        </div>
      }
    </div>
  `
})
export class PatientShoppingList implements OnInit {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly menuService = inject(MenuService);
  private readonly shoppingListService = inject(ShoppingListService);

  shoppingList = signal<ShoppingListDto | null>(null);
  loading = signal(false);
  items = signal<ShoppingListItemDto[]>([]);

  groupedItems = signal<{ category: string; items: ShoppingListItemDto[] }[]>([]);

  totalPrice = signal('0.00');

  ngOnInit() {
    this.load();
  }

  private load() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.menuService.history(tenantId, userId).subscribe({
      next: (menuList) => {
        const active = (menuList || []).find(m => m.isActive || m.active);
        if (active) {
          this.shoppingListService.getByMenuId(tenantId, active.id).subscribe({
            next: (list) => {
              this.shoppingList.set(list);
              this.items.set(list.items || []);
              this.groupItems(list.items || []);
              this.calcTotal(list.items || []);
              this.loading.set(false);
            },
            error: () => this.loading.set(false)
          });
        } else {
          this.loading.set(false);
        }
      },
      error: () => this.loading.set(false)
    });
  }

  private groupItems(items: ShoppingListItemDto[]) {
    const map = new Map<string, ShoppingListItemDto[]>();
    for (const item of items) {
      const cat = item.category || 'Otros';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    this.groupedItems.set(
      Array.from(map.entries()).map(([category, items]) => ({ category, items }))
    );
  }

  private calcTotal(items: ShoppingListItemDto[]) {
    const total = items.reduce((s, i) => s + (i.estimatedPrice || 0), 0);
    this.totalPrice.set(total.toFixed(2));
  }

  supermarketLabel(supermarket: string): string {
    return SUPERMARKET_LABELS[supermarket] || supermarket;
  }

  toggleItem(item: ShoppingListItemDto, checked: boolean) {
    const tenantId = this.tenantCtx.currentTenantId();
    const list = this.shoppingList();
    if (!tenantId || !list) return;

    const prev = item.checked;
    item.checked = checked;

    this.shoppingListService.updateItemStatus(tenantId, list.id, item.id, { checked }).subscribe({
      error: () => {
        item.checked = prev;
      }
    });
  }
}
