import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton, TuiDataList, TuiDropdown, TuiInput } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';

import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { Menu } from '../../core/api/models/menu.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { MenuFormDialog } from './menu-form.dialog';
import { MenuUploadDialog } from './menu-upload.dialog';
import { MenuRenameDialog, MenuRenameDialogInput } from './menu-rename.dialog';
import { EmptyState } from '../../shared/ui/empty-state';

/** Chip de estado del listado de menús. `all` no envía el parámetro `isActive`. */
export type MenuStatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-menus-list',
  standalone: true,
  imports: [RouterModule, DatePipe, ReactiveFormsModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiButton, TuiBadge, TuiTable, TuiInput, TuiSegmented, TuiDropdown, TuiDataList],
  templateUrl: './menus-list.page.html'
})
export default class MenusListPage implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  canManageMenu = computed(() => this.permissionsService.has('MANAGE_MENU'));
  canActivateMenu = computed(() =>
    this.canManageMenu() || this.tenantCtx.currentMembership()?.userType === 'PATIENT'
  );

  menus = signal<Menu[]>([]);
  loading = signal(false);
  totalRecords = signal(0);
  searchControl = new FormControl('');

  /** Filtro por estado (base de datos). */
  readonly statusFilter = signal<MenuStatusFilter>('all');
  /** Contadores de los chips, calculados sobre la búsqueda activa. */
  readonly statusCounts = signal<{ active: number; inactive: number } | null>(null);

  /** Índice del chip activo (0 = todos, 1 = activos, 2 = inactivos). */
  readonly filterIndex = computed(() => {
    switch (this.statusFilter()) {
      case 'active': return 1;
      case 'inactive': return 2;
      default: return 0;
    }
  });

  sortKey = signal<string>('name');
  sortDirection = signal<'ASC' | 'DESC'>('ASC');

  lastPage = 0;
  lastSize = 25;

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.lastPage = 0;
      this.reload();
    });

    this.reload();
  }

  /** Recarga listado y contadores (búsqueda, filtro o página). */
  private reload() {
    this.loadMenus(this.lastPage, this.lastSize);
    this.loadStatusCounts();
  }

  setStatusFilterIndex(index: number) {
    const next: MenuStatusFilter = index === 1 ? 'active' : index === 2 ? 'inactive' : 'all';
    if (this.statusFilter() === next) return;
    this.statusFilter.set(next);
    this.lastPage = 0;
    this.reload();
  }

  onPage(page: number) {
    this.lastPage = page;
    this.reload();
  }

  prevPage() {
    if (this.lastPage > 0) {
      this.lastPage--;
      this.reload();
    }
  }

  nextPage() {
    if ((this.lastPage + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage++;
      this.reload();
    }
  }

  onSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('ASC');
    }
    this.lastPage = 0;
    this.reload();
  }

  /** Cuenta activos e inactivos con la búsqueda actual (dos peticiones ligeras `size=1`). */
  private loadStatusCounts() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;
    const name = this.searchControl.value?.trim() || undefined;

    forkJoin({
      active: this.menuService.search(tenantId, 0, 1, ['name,ASC'], userId, name, true),
      inactive: this.menuService.search(tenantId, 0, 1, ['name,ASC'], userId, name, false)
    }).subscribe({
      next: ({ active, inactive }) => this.statusCounts.set({
        active: active.page?.totalElements ?? 0,
        inactive: inactive.page?.totalElements ?? 0
      }),
      error: () => this.statusCounts.set(null)
    });
  }

  loadMenus(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    const isActive = this.statusFilter() === 'all' ? undefined : this.statusFilter() === 'active';

    this.loading.set(true);
    this.menuService.search(
      tenantId,
      page,
      size,
      [`${this.sortKey()},${this.sortDirection()}`],
      userId,
      this.searchControl.value?.trim() || undefined,
      isActive
    ).subscribe({
      next: (res) => {
        this.menus.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  viewMenu(menu: Menu) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      this.router.navigate(['/menus', menu.id]);
    }
  }

  createMenu() {
    this.modal.open<Menu>(MenuFormDialog, {
      label: this.transloco.translate('diets.create_title'),
      size: 'm'
    }).subscribe(result => {
      if (result) {
        this.notify.success(this.transloco.translate('diets.created_success'));
        this.reload();
      }
    });
  }

  uploadMenu() {
    this.modal.open<Menu>(MenuUploadDialog, {
      label: this.transloco.translate('diets.upload_title'),
      size: 'm'
    }).subscribe(result => {
      if (result) {
        this.reload();
      }
    });
  }

  deleteMenu(menu: Menu) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('diets.delete_confirm', { name: menu.name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe(confirmed => {
      if (confirmed) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.menuService.delete(tenantId, menu.id).subscribe(() => {
            this.notify.success(this.transloco.translate('notifications.menu_deleted'));
            this.reload();
          });
        }
      }
    });
  }

  toggleActiveMenu(menu: Menu) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.menuService.update(tenantId, menu.id, { isActive: !menu.isActive }).subscribe(() => {
      this.notify.success(
        !menu.isActive
          ? this.transloco.translate('menu_history.activated')
          : this.transloco.translate('menu_history.deactivated')
      );
      this.reload();
    });
  }

  renameMenu(menu: Menu) {
    this.modal.open<Menu, MenuRenameDialogInput>(MenuRenameDialog, {
      label: this.transloco.translate('diets.rename_title'),
      size: 'm',
      data: { menu }
    }).subscribe(result => {
      if (result) {
        this.notify.success(this.transloco.translate('diets.renamed'));
        this.reload();
      }
    });
  }
}
