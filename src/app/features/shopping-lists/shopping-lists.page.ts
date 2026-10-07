import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiCheckbox } from '@taiga-ui/core';
import { TuiProgressBar } from '@taiga-ui/kit';

import { ShoppingListService } from '../../core/api/services/shopping-list.api';
import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { ShoppingListDto, ShoppingListItemDto } from '../../core/api/models/shopping-list.model';
import { NotificationService } from '../../core/ui';
import { EmptyState } from '../../shared/ui/empty-state';

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

/**
 * Icono por categoría. El backend (IA) no fija un catálogo cerrado, así que se
 * busca por palabra clave y se cae a la cesta genérica. Solo iconos free.
 */
const CATEGORY_ICONS: { match: string; icon: string }[] = [
  { match: 'conserva', icon: 'fa-solid fa-basket-shopping' },
  { match: 'legumbre', icon: 'fa-solid fa-seedling' },
  { match: 'pasta', icon: 'fa-solid fa-wheat-awn' },
  { match: 'arroz', icon: 'fa-solid fa-bowl-rice' },
  { match: 'cereal', icon: 'fa-solid fa-wheat-awn' },
  { match: 'desayuno', icon: 'fa-solid fa-mug-saucer' },
  { match: 'snack', icon: 'fa-solid fa-cookie-bite' },
  { match: 'fruto', icon: 'fa-solid fa-seedling' },
  { match: 'fruta', icon: 'fa-solid fa-apple-whole' },
  { match: 'verdura', icon: 'fa-solid fa-carrot' },
  { match: 'carne', icon: 'fa-solid fa-drumstick-bite' },
  { match: 'pescado', icon: 'fa-solid fa-fish' },
  { match: 'lacteo', icon: 'fa-solid fa-cheese' },
  { match: 'lácteo', icon: 'fa-solid fa-cheese' },
  { match: 'huevo', icon: 'fa-solid fa-egg' },
  { match: 'bebida', icon: 'fa-solid fa-bottle-water' },
  { match: 'pan', icon: 'fa-solid fa-bread-slice' },
  { match: 'congelado', icon: 'fa-solid fa-snowflake' },
  { match: 'limpieza', icon: 'fa-solid fa-spray-can-sparkles' },
  { match: 'higiene', icon: 'fa-solid fa-pump-soap' },
  { match: 'aceite', icon: 'fa-solid fa-bottle-droplet' },
  { match: 'condimento', icon: 'fa-solid fa-mortar-pestle' },
];

/** Etiqueta compacta de la unidad (el backend guarda el valor crudo). */
const UNIT_LABELS: Record<string, string> = {
  unidad: 'ud.',
  ud: 'ud.',
  kg: 'kg',
  g: 'g',
  l: 'L',
  ml: 'ml',
  pack: 'pack',
  caja: 'caja',
  lata: 'lata',
  botella: 'botella',
};

/** Grupo de productos de una misma categoría, ya resuelto para la plantilla. */
interface ShoppingGroupVm {
  category: string;
  icon: string;
  items: ShoppingListItemDto[];
}

@Component({
  selector: 'app-shopping-lists',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoDirective,
    EmptyState,
    SkeletonComponent,
    TuiCheckbox,
    TuiProgressBar,
  ],
  templateUrl: './shopping-lists.page.html',
  styles: [`
    /* Resumen pegajoso: en móvil queda por encima de la barra inferior. */
    .shopping-summary {
      position: sticky;
      bottom: 0;
      z-index: 10;
    }
    @media (max-width: 767px) {
      .shopping-summary {
        bottom: calc(var(--bottom-nav-h, 60px) + env(safe-area-inset-bottom, 0px));
      }
    }
  `],
})
export default class ShoppingListsPage implements OnInit {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly menuService = inject(MenuService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  loading = signal(false);
  shoppingList = signal<ShoppingListDto | null>(null);
  items = signal<ShoppingListItemDto[]>([]);

  /** La base de datos solo guarda la lista actual; se muestra esa y punto. */
  readonly groupedItems = computed<ShoppingGroupVm[]>(() => {
    const map = new Map<string, ShoppingListItemDto[]>();
    for (const item of this.items()) {
      const category = item.category?.trim() || this.transloco.translate('shopping_list.other_category');
      if (!map.has(category)) map.set(category, []);
      map.get(category)!.push(item);
    }
    return Array.from(map.entries()).map(([category, items]) => ({
      category,
      icon: iconForCategory(category),
      items,
    }));
  });

  readonly purchasedCount = computed(() => this.items().filter((item) => item.checked).length);
  readonly totalCount = computed(() => this.items().length);

  readonly progressPct = computed(() => {
    const total = this.totalCount();
    return total === 0 ? 0 : Math.round((this.purchasedCount() / total) * 100);
  });

  private readonly currency = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  });

  readonly totalPrice = computed(() => {
    const list = this.shoppingList();
    const total = list?.totalEstimatedPrice
      ?? this.items().reduce((sum, item) => sum + (item.estimatedPrice || 0), 0);
    return this.currency.format(total);
  });

  ngOnInit() {
    this.load();
  }

  load() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    // La lista actual cuelga del menú activo del paciente: mismo camino que el
    // panel, así no dependemos de que exista un histórico.
    this.menuService.history(tenantId, userId).subscribe({
      next: (menus) => {
        const active = (menus || []).find((menu) => menu.isActive || menu.active);
        if (!active) {
          this.shoppingList.set(null);
          this.items.set([]);
          this.loading.set(false);
          return;
        }

        this.shoppingListService.getByMenuId(tenantId, active.id).subscribe({
          next: (list) => {
            this.shoppingList.set(list ?? null);
            this.items.set(list?.items ?? []);
            this.loading.set(false);
          },
          error: () => {
            this.shoppingList.set(null);
            this.items.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => {
        this.shoppingList.set(null);
        this.items.set([]);
        this.loading.set(false);
      },
    });
  }

  supermarketLabel(supermarket: string): string {
    return SUPERMARKET_LABELS[supermarket] || supermarket;
  }

  unitLabel(unit: string): string {
    if (!unit) return '';
    return UNIT_LABELS[unit.toLowerCase()] ?? unit;
  }

  /** Actualiza la casilla con actualización optimista y revierte si falla. */
  toggleItem(item: ShoppingListItemDto, checked: boolean) {
    const tenantId = this.tenantCtx.currentTenantId();
    const list = this.shoppingList();
    if (!tenantId || !list) return;

    const previous = item.checked;
    item.checked = checked;
    this.items.update((items) => [...items]);

    this.shoppingListService.updateItemStatus(tenantId, list.id, item.id, { checked }).subscribe({
      error: () => {
        item.checked = previous;
        this.items.update((items) => [...items]);
        this.notify.error(this.transloco.translate('shopping_list.update_error'));
      },
    });
  }
}

function iconForCategory(category: string): string {
  const normalized = category.toLowerCase();
  const match = CATEGORY_ICONS.find((entry) => normalized.includes(entry.match));
  return match?.icon ?? 'fa-solid fa-cart-shopping';
}
