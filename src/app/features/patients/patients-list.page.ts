import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiCheckbox, TuiDataList, TuiDropdown, TuiInput } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { debounceTime, distinctUntilChanged, forkJoin } from 'rxjs';

import { UserTenantRoleService, UserSearchParams } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AppUserDto } from '../../core/api/models/user.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { EmptyState } from '../../shared/ui/empty-state';
import { PaginationFooter } from '../../shared/ui/pagination-footer';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { formatInstant } from '../../shared/utils/date';
import { InviteUserDialog, InviteUserDialogInput } from '../users/invite-user.dialog';
import { EditUserDialog, EditUserDialogInput } from '../users/edit-user.dialog';

/** Chip de estado del listado. `all` no envía el parámetro `enabled`. */
export type PatientStatusFilter = 'all' | 'active' | 'inactive';

/** Etiqueta relativa traducida: clave i18n + parámetros. */
export interface RelativeStamp {
  key: string;
  params: Record<string, number>;
}

/** Fila del listado con las fechas ya convertidas a texto relativo. */
export interface PatientRowVm {
  user: AppUserDto;
  lastVisit: RelativeStamp | null;
  nextAppointment: RelativeStamp | null;
}

/** Dirección por defecto de cada columna ordenable (la del prototipo). */
const DEFAULT_DIR: Record<string, 'ASC' | 'DESC'> = {
  firstName: 'ASC',
  lastName: 'ASC',
  email: 'ASC',
  phone: 'ASC',
  enabled: 'ASC',
  birthDate: 'ASC',
  lastAppointmentDate: 'DESC',
  nextAppointmentDate: 'ASC'
};

const DAY_MS = 86_400_000;

/** Diferencia en días naturales entre hoy y `iso` (negativo = pasado, null = sin fecha). */
function dayDiff(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
}

/** Convierte un instante ISO en una etiqueta relativa («hace 3 días», «en 2 semanas»…). */
function relativeStamp(iso: string | null | undefined): RelativeStamp | null {
  const days = dayDiff(iso);
  if (days === null) return null;
  if (days === 0) return { key: 'patients.rel_today', params: {} };
  const n = Math.abs(days);
  if (days > 0) {
    if (n === 1) return { key: 'patients.rel_tomorrow', params: {} };
    if (n < 14) return { key: 'patients.rel_in_days', params: { n } };
    if (n < 60) return { key: 'patients.rel_in_weeks', params: { n: Math.round(n / 7) } };
    return { key: 'patients.rel_in_months', params: { n: Math.round(n / 30) } };
  }
  if (n === 1) return { key: 'patients.rel_yesterday', params: {} };
  if (n < 14) return { key: 'patients.rel_days_ago', params: { n } };
  if (n < 60) return { key: 'patients.rel_weeks_ago', params: { n: Math.round(n / 7) } };
  return { key: 'patients.rel_months_ago', params: { n: Math.round(n / 30) } };
}

@Component({
  selector: 'app-patients-list',
  standalone: true,
  imports: [
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    IfPermissionDirective,
    TranslocoDirective,
    EmptyState,
    PaginationFooter,
    SkeletonComponent,
    TuiTable,
    TuiButton,
    TuiCheckbox,
    TuiInput,
    TuiBadge,
    TuiSegmented,
    TuiDropdown,
    TuiDataList
  ],
  templateUrl: './patients-list.page.html'
})
export default class PatientsListPage implements OnInit {
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);

  users = signal<AppUserDto[]>([]);
  loading = signal(false);
  paginating = signal(false);
  exporting = signal(false);
  private hasLoadedOnce = false;
  totalRecords = signal(0);
  searchControl = new FormControl('');

  /** Filtro por estado (base de datos, no rompe la paginación). */
  readonly statusFilter = signal<PatientStatusFilter>('all');
  /** Contadores de los chips, calculados sobre la búsqueda activa. */
  readonly statusCounts = signal<{ active: number; inactive: number } | null>(null);

  canDeleteUsers = computed(() => {
    const role = this.tenantCtx.currentMembership()?.roleCode;
    return role !== 'NUTRITIONIST' && (this.permissionsService.has('MANAGE_USER'));
  });

  canManageUsers = computed(() => this.permissionsService.has('MANAGE_USER'));

  /** Solo el ADMIN del centro ve la columna «Profesional». */
  isTenantAdmin = computed(() => {
    const role = this.tenantCtx.currentMembership()?.roleCode;
    return role === 'ADMIN' &&
      (this.permissionsService.has('MANAGE_TENANT') || this.permissionsService.has('MANAGE_USER'));
  });

  sortKey = signal<string>('lastAppointmentDate');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  /** Selección múltiple para las acciones en lote. */
  readonly selectedIds = signal<ReadonlySet<string>>(new Set<string>());

  /** Filas listas para pintar (fechas relativas ya resueltas). */
  readonly rows = computed<PatientRowVm[]>(() => this.users().map(user => ({
    user,
    lastVisit: relativeStamp(user.lastAppointmentDate),
    nextAppointment: relativeStamp(user.nextAppointmentDate)
  })));

  readonly selectedCount = computed(() => this.selectedIds().size);

  readonly allSelected = computed(() => {
    const ids = this.users().map(u => u.id);
    return ids.length > 0 && ids.every(id => this.selectedIds().has(id));
  });

  /** Índice del chip activo (0 = todos, 1 = activos, 2 = inactivos). */
  readonly filterIndex = computed(() => {
    switch (this.statusFilter()) {
      case 'active': return 1;
      case 'inactive': return 2;
      default: return 0;
    }
  });

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

  /** Recarga listado y contadores (búsqueda, filtro, orden o página). */
  private reload() {
    this.loadUsers();
    this.loadStatusCounts();
  }

  setStatusFilterIndex(index: number) {
    const next: PatientStatusFilter = index === 1 ? 'active' : index === 2 ? 'inactive' : 'all';
    if (this.statusFilter() === next) return;
    this.statusFilter.set(next);
    this.lastPage = 0;
    this.clearSelection();
    this.reload();
  }

  /** Query params del listado, con la página actual. */
  private buildSearchParams(overrides?: Partial<UserSearchParams>): UserSearchParams {
    const enabled = this.statusFilter() === 'all' ? undefined : this.statusFilter() === 'active';
    return {
      search: this.searchControl.value?.trim() || undefined,
      enabled,
      page: this.lastPage,
      size: this.lastSize,
      sort: [`${this.sortKey()},${this.sortDirection()}`],
      ...overrides
    };
  }

  loadUsers() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    if (this.hasLoadedOnce) {
      this.paginating.set(true);
    } else {
      this.loading.set(true);
    }

    this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', this.buildSearchParams()).subscribe({
      next: (res) => {
        this.users.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loading.set(false);
        this.paginating.set(false);
        this.hasLoadedOnce = true;
        this.pruneSelection();
      },
      error: () => {
        this.loading.set(false);
        this.paginating.set(false);
      }
    });
  }

  /** Cuenta activos e inactivos con la búsqueda actual (dos peticiones ligeras `size=1`). */
  private loadStatusCounts() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    const search = this.searchControl.value?.trim() || undefined;

    forkJoin({
      active: this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', { search, enabled: true, page: 0, size: 1 }),
      inactive: this.userTenantRoleService.getUsersByTenantAndType(tenantId, 'PATIENT', { search, enabled: false, page: 0, size: 1 })
    }).subscribe({
      next: ({ active, inactive }) => this.statusCounts.set({
        active: active.page?.totalElements ?? 0,
        inactive: inactive.page?.totalElements ?? 0
      }),
      error: () => this.statusCounts.set(null)
    });
  }

  onSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set(DEFAULT_DIR[key] ?? 'ASC');
    }
    this.lastPage = 0;
    this.loadUsers();
  }

  isSorted(key: string): boolean {
    return this.sortKey() === key;
  }

  /** Fecha absoluta formateada, para el `title` de los textos relativos. */
  absoluteDate(iso: string | null | undefined): string {
    return iso ? formatInstant(iso) : '';
  }

  // ── Selección múltiple ──────────────────────────────────────────────

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleRow(id: string) {
    const next = new Set(this.selectedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds.set(next);
  }

  toggleAll() {
    this.selectedIds.set(this.allSelected() ? new Set<string>() : new Set(this.users().map(u => u.id)));
  }

  clearSelection() {
    this.selectedIds.set(new Set<string>());
  }

  /** Quita de la selección las filas que ya no están visibles. */
  private pruneSelection() {
    const visible = new Set(this.users().map(u => u.id));
    const current = this.selectedIds();
    if ([...current].every(id => visible.has(id))) return;
    this.selectedIds.set(new Set([...current].filter(id => visible.has(id))));
  }

  /** Activa o desactiva en lote los pacientes seleccionados. */
  bulkSetStatus(enabled: boolean) {
    const ids = [...this.selectedIds()];
    if (ids.length === 0) return;
    const labelKey = enabled ? 'users.enable_confirm_title' : 'users.disable_confirm_title';
    const msgKey = enabled ? 'patients.bulk_enable_confirm' : 'patients.bulk_disable_confirm';

    this.confirm.confirm({
      label: this.transloco.translate(labelKey),
      content: this.transloco.translate(msgKey, { count: ids.length }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (!tenantId) return;

      this.userTenantRoleService.bulkSetUserStatus(tenantId, ids, enabled).subscribe({
        next: (res) => {
          const failed = res.failedIds?.length ?? 0;
          if (failed > 0) {
            this.notify.error(
              this.transloco.translate('patients.bulk_partial', { updated: res.updated, requested: res.requested, failed }),
              this.transloco.translate('common.attention')
            );
          } else {
            this.notify.success(this.transloco.translate('patients.bulk_success', { count: res.updated }));
          }
          this.clearSelection();
          this.reload();
        },
        error: () => this.notify.error(this.transloco.translate('common.error'))
      });
    });
  }

  /** Exporta a CSV todo el listado filtrado (sin paginar). */
  exportCsv() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.exporting.set(true);
    const params: UserSearchParams = {
      search: this.searchControl.value?.trim() || undefined,
      enabled: this.statusFilter() === 'all' ? undefined : this.statusFilter() === 'active',
      sort: [`${this.sortKey()},${this.sortDirection()}`]
    };

    this.userTenantRoleService.exportUsersCsv(tenantId, 'PATIENT', params).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        this.downloadBlob(blob, 'pacientes.csv');
      },
      error: () => {
        this.exporting.set(false);
        this.notify.error(this.transloco.translate('patients.export_error'));
      }
    });
  }

  /** Exporta en cliente solo las filas marcadas (mismas columnas que el export del backend). */
  exportSelection() {
    const selected = this.users().filter(u => this.selectedIds().has(u.id));
    if (selected.length === 0) return;

    const header = ['Nombre', 'Apellidos', 'Email', 'Telefono', 'Estado', 'Edad', 'Profesional', 'Ultima visita', 'Proxima cita'];
    const activeLabel = this.transloco.translate('users.status_active');
    const disabledLabel = this.transloco.translate('users.status_disabled');
    const rows = selected.map(u => [
      u.firstName,
      u.lastName,
      u.email,
      u.phone ?? '',
      u.enabled !== false ? activeLabel : disabledLabel,
      u.age ?? '',
      u.assignedNutritionistName ?? '',
      u.lastAppointmentDate ?? '',
      u.nextAppointmentDate ?? ''
    ]);

    const csv = [header, ...rows]
      .map(row => row.map(cell => this.csvCell(String(cell))).join(';'))
      .join('\r\n');
    // BOM + `;` para que Excel lo abra bien en español, igual que el backend.
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, 'pacientes-seleccion.csv');
  }

  private csvCell(value: string): string {
    return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  }

  private downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  onPage(page: number) {
    this.lastPage = page;
    this.loadUsers();
  }

  prevPage() {
    if (this.lastPage > 0) {
      this.lastPage--;
      this.loadUsers();
    }
  }

  nextPage() {
    if ((this.lastPage + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage++;
      this.loadUsers();
    }
  }

  showInviteDialog() {
    this.modal.open<boolean, InviteUserDialogInput>(InviteUserDialog, {
      label: this.transloco.translate('patients.invite'),
      size: 'm',
      data: { lockedUserType: 'PATIENT' }
    }).subscribe((result) => {
      // El diálogo emite `true` solo si la invitación se creó; cerrar sin
      // guardar no debe mostrar el aviso de éxito.
      if (!result) return;
      this.notify.success(this.transloco.translate('patients.invite_success'));
      this.reload();
    });
  }

  editUser(user: AppUserDto) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.userTenantRoleService.getUser(tenantId, user.id).subscribe(fullUser => {
      this.modal.open<boolean, EditUserDialogInput>(EditUserDialog, {
        label: this.transloco.translate('users.edit_user_title'),
        size: 'm',
        data: { user: fullUser }
      }).subscribe(() => this.loadUsers());
    });
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
          this.notify.success(this.transloco.translate('patients.remove_success'));
          this.reload();
        });
      }
    });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  }

  toggleEnabled(user: AppUserDto) {
    const enabling = !user.enabled;
    const name = `${user.firstName} ${user.lastName}`;
    const labelKey = enabling ? 'users.enable_confirm_title' : 'users.disable_confirm_title';
    const msgKey = enabling ? 'users.enable_confirm_msg' : 'users.disable_confirm_msg';

    this.confirm.confirm({
      label: this.transloco.translate(labelKey),
      content: this.transloco.translate(msgKey, { name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.userTenantRoleService.setUserEnabled(tenantId, user.id, enabling).subscribe({
          next: () => {
            const successKey = enabling ? 'users.enable_success' : 'users.disable_success';
            this.notify.success(this.transloco.translate(successKey));
            this.reload();
          },
          error: (err) => {
            if (err.status === 409) {
              this.notify.error(this.transloco.translate('users.disable_conflict'));
            } else {
              this.notify.error(this.transloco.translate('common.error'));
            }
          }
        });
      }
    });
  }
}
