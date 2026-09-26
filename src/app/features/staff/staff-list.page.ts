import { Component, computed, inject, signal, OnInit } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiDataList, TuiDropdown, TuiInput } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';

import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { PaginationFooter } from '../../shared/ui/pagination-footer';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { InviteUserDialog, InviteUserDialogInput } from '../users/invite-user.dialog';
import { EditUserDialog, EditUserDialogInput } from '../users/edit-user.dialog';

/** Chip de estado del listado de equipo. `all` no filtra. */
export type StaffStatusFilter = 'all' | 'active' | 'inactive';

/**
 * Listado de equipo. El backend devuelve todos los miembros de una vez
 * (`size: 1000`), así que la búsqueda, el filtro por estado, el orden y la
 * paginación se resuelven en cliente para que la página se comporte igual que
 * el resto de listados (menús, plantillas, pacientes).
 */
@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    IfPermissionDirective,
    TranslocoDirective,
    EmptyState,
    PaginationFooter,
    SkeletonComponent,
    TuiTable,
    TuiButton,
    TuiBadge,
    TuiDropdown,
    TuiDataList,
    TuiInput,
    TuiSegmented,
  ],
  templateUrl: './staff-list.page.html'
})
export default class StaffListPage implements OnInit {
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  readonly canManageUsers = computed(() => this.permissionsService.has('MANAGE_USER'));

  users = signal<AppUserDto[]>([]);
  loading = signal(false);
  searchControl = new FormControl('');

  /**
   * El término de búsqueda como signal. El `computed` de abajo tiene que
   * reaccionar a lo que se escribe, y `FormControl.value` no es un signal.
   */
  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: '' });

  readonly statusFilter = signal<StaffStatusFilter>('all');
  readonly sortKey = signal<string>('firstName');
  readonly sortDirection = signal<'ASC' | 'DESC'>('ASC');

  readonly lastPage = signal(0);
  readonly lastSize = 25;

  /** Índice del chip activo (0 = todos, 1 = activos, 2 = inactivos). */
  readonly filterIndex = computed(() => {
    switch (this.statusFilter()) {
      case 'active': return 1;
      case 'inactive': return 2;
      default: return 0;
    }
  });

  /** Contadores de los chips, sobre el total (sin filtro de estado). */
  readonly statusCounts = computed(() => ({
    active: this.users().filter(u => u.enabled !== false).length,
    inactive: this.users().filter(u => u.enabled === false).length,
  }));

  /** Miembros tras aplicar búsqueda y filtro de estado. */
  private readonly filtered = computed(() => {
    const term = String(this.searchTerm() ?? '').trim().toLowerCase();
    const status = this.statusFilter();

    return this.users().filter(user => {
      const matchesTerm = !term
        || `${user.firstName} ${user.lastName} ${user.email} ${this.getRole(user)}`
          .toLowerCase()
          .includes(term);
      const matchesStatus = status === 'all'
        || (status === 'active' ? user.enabled !== false : user.enabled === false);
      return matchesTerm && matchesStatus;
    });
  });

  private readonly sorted = computed(() => {
    const key = this.sortKey();
    const factor = this.sortDirection() === 'ASC' ? 1 : -1;
    return [...this.filtered()].sort((a, b) =>
      this.sortValue(a, key).localeCompare(this.sortValue(b, key), 'es', { sensitivity: 'base' }) * factor
    );
  });

  readonly totalRecords = computed(() => this.filtered().length);

  /** Página visible. */
  readonly rows = computed(() => {
    const start = this.lastPage() * this.lastSize;
    return this.sorted().slice(start, start + this.lastSize);
  });

  ngOnInit() {
    // Al cambiar la búsqueda, cualquier página deja de ser válida.
    this.searchControl.valueChanges.subscribe(() => this.lastPage.set(0));

    this.loadUsers();
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'STAFF', { size: 1000 }).subscribe({
      next: (res) => {
        this.users.set(res.content || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  getRole(user: AppUserDto): string {
    if (user.roleName) return user.roleName;
    const tenantId = this.tenantCtx.currentTenantId();
    const membership = user.memberships?.find(m => m.tenantId === tenantId);
    return membership?.roleCode || 'DESCONOCIDO';
  }

  isSorted(key: string): boolean {
    return this.sortKey() === key;
  }

  onSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('ASC');
    }
    this.lastPage.set(0);
  }

  setStatusFilterIndex(index: number) {
    const next: StaffStatusFilter = index === 1 ? 'active' : index === 2 ? 'inactive' : 'all';
    if (this.statusFilter() === next) return;
    this.statusFilter.set(next);
    this.lastPage.set(0);
  }

  prevPage() {
    if (this.lastPage() > 0) {
      this.lastPage.update(page => page - 1);
    }
  }

  nextPage() {
    if ((this.lastPage() + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage.update(page => page + 1);
    }
  }

  /** Valor por el que ordenar cada columna. */
  private sortValue(user: AppUserDto, key: string): string {
    switch (key) {
      case 'firstName': return user.firstName ?? '';
      case 'lastName': return user.lastName ?? '';
      case 'email': return user.email ?? '';
      case 'role': return this.getRole(user);
      case 'enabled': return user.enabled === false ? '0' : '1';
      default: return '';
    }
  }

  showInviteDialog() {
    this.modal.open<boolean, InviteUserDialogInput>(InviteUserDialog, {
      label: this.transloco.translate('staff.invite_dialog_title'),
      size: 'm',
      data: { lockedUserType: 'STAFF' }
    }).subscribe((invited) => {
      if (!invited) return;
      this.notify.success(this.transloco.translate('staff.invite_success'));
      this.loadUsers();
    });
  }

  editUser(user: AppUserDto) {
    this.modal.open<boolean, EditUserDialogInput>(EditUserDialog, {
      label: this.transloco.translate('users.edit_user_title'),
      size: 'm',
      data: { user }
    }).subscribe(() => this.loadUsers());
  }

  revokeAccess(user: AppUserDto) {
    this.confirm.confirm({
      label: this.transloco.translate('users.revoke_confirm_title'),
      content: this.transloco.translate('users.revoke_confirm_msg', { name: user.firstName + ' ' + user.lastName }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.userTenantRoleService.revokeAccess(tenantId, user.id).subscribe(() => {
          this.notify.success(this.transloco.translate('staff.revoke_success'));
          this.loadUsers();
        });
      }
    });
  }
}
