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
  templateUrl: './patient-shopping-list.html'
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
