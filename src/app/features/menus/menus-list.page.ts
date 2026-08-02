import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { MenuService } from '../../core/api/services/menu.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { Menu } from '../../core/api/models/menu.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { MenuFormDialog } from './menu-form.dialog';
import { MenuUploadDialog } from './menu-upload.dialog';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-menus-list',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiButton, TuiBadge, TuiTable, TuiInput],
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

  menus = signal<Menu[]>([]);
  loading = signal(false);
  totalRecords = signal(0);
  searchControl = new FormControl('');

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
      this.loadMenus(this.lastPage, this.lastSize);
    });

    this.loadMenus(0, 25);
  }

  onPage(page: number) {
    this.lastPage = page;
    this.loadMenus(this.lastPage, this.lastSize);
  }

  prevPage() {
    if (this.lastPage > 0) {
      this.lastPage--;
      this.loadMenus(this.lastPage, this.lastSize);
    }
  }

  nextPage() {
    if ((this.lastPage + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage++;
      this.loadMenus(this.lastPage, this.lastSize);
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
    this.loadMenus(this.lastPage, this.lastSize);
  }

  loadMenus(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.menuService.search(
      tenantId,
      page,
      size,
      [`${this.sortKey()},${this.sortDirection()}`],
      userId,
      this.searchControl.value?.trim() || undefined
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
      label: 'Crear Menú Manualmente',
      size: 'm'
    }).subscribe(result => {
      if (result) {
        this.notify.success('Menú creado correctamente');
        this.loadMenus(this.lastPage, this.lastSize);
      }
    });
  }

  uploadMenu() {
    this.modal.open<Menu>(MenuUploadDialog, {
      label: 'Subir Menú (Reconocimiento por IA)',
      size: 'm'
    }).subscribe(result => {
      if (result) {
        this.loadMenus(this.lastPage, this.lastSize);
      }
    });
  }

  deleteMenu(menu: Menu) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: '¿Estás seguro de que quieres eliminar el menú "' + menu.name + '"?',
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe(confirmed => {
      if (confirmed) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.menuService.delete(tenantId, menu.id).subscribe(() => {
            this.notify.success('Menú eliminado');
            this.loadMenus(this.lastPage, this.lastSize);
          });
        }
      }
    });
  }
}
