import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TranslocoDirective } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';

import { ShoppingListService } from '../../core/api/services/shopping-list.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { ShoppingListDto } from '../../core/api/models/shopping-list.model';
import { EmptyState } from '../../shared/ui/empty-state';
import { ShoppingListDialog } from '../menus/shopping-list.dialog';
import { ModalService } from '../../core/ui';

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
  selector: 'app-shopping-lists',
  standalone: true,
  imports: [DatePipe, TranslocoDirective, EmptyState, SkeletonComponent, TuiButton, TuiTable],
  templateUrl: './shopping-lists.page.html'
})
export default class ShoppingListsPage implements OnInit {
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly router = inject(Router);

  lists = signal<ShoppingListDto[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loadLists();
  }

  loadLists() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.shoppingListService.getByUserId(tenantId, userId).subscribe({
      next: (res) => {
        this.lists.set(res || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  supermarketLabel(supermarket: string): string {
    return SUPERMARKET_LABELS[supermarket] || supermarket;
  }

  totalLabel(list: ShoppingListDto): string {
    return list.totalEstimatedPrice != null ? `${list.totalEstimatedPrice.toFixed(2)} €` : '—';
  }

  viewList(list: ShoppingListDto) {
    this.modal.open(ShoppingListDialog, {
      label: list.name || 'Lista de la compra',
      size: 'l',
      data: { shoppingList: list }
    }).subscribe();
  }
}
