import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { finalize } from 'rxjs/operators';

import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiTextfield, TuiInput, TuiLabel } from '@taiga-ui/core';
import { TuiBadge, TuiChevron, TuiDataListWrapper, TuiSelect } from '@taiga-ui/kit';

import { PlatformBillingService } from '../../../core/api/services/platform-billing.api';
import {
  BILLING_STATUSES,
  BillingStatus,
  TenantBillingAdminDto,
} from '../../../core/api/models/billing.model';
import { NotificationService } from '../../../core/ui';
import { billingErrorMessage } from '../../../core/billing/billing-error';
import { EmptyState } from '../../../shared/ui/empty-state';
import { PaginationFooter } from '../../../shared/ui/pagination-footer';

const PAGE_SIZE = 20;
/** Opción «todos» del filtro: el backend no recibe `status` cuando está puesta. */
const ALL = 'ALL';

/**
 * Panel de superadmin: la suscripción de todos los centros de la plataforma.
 *
 * Vive bajo `/admin`, que ya exige `MANAGE_TENANT` y centro administrador
 * (`adminGuard`), así que la pantalla no vuelve a comprobar permisos.
 */
@Component({
  selector: 'app-admin-billing-list-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    TuiTable,
    TuiButton,
    TuiTextfield,
    TuiChevron,
    TuiInput,
    TuiLabel,
    TuiBadge,
    TuiSelect,
    TuiDataListWrapper,
    EmptyState,
    PaginationFooter,
  ],
  templateUrl: './admin-billing-list.page.html',
})
export default class AdminBillingListPage implements OnInit {
  private readonly api = inject(PlatformBillingService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly tenants = signal<TenantBillingAdminDto[]>([]);
  readonly loading = signal(false);
  readonly page = signal(0);
  readonly total = signal(0);
  readonly pageSize = PAGE_SIZE;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<string>(ALL, { nonNullable: true });

  readonly statusOptions = [ALL, ...BILLING_STATUSES];

  /** Etiqueta de cada opción del desplegable; la usa Taiga para pintar y buscar. */
  readonly statusStringify = (status: string): string =>
    status === ALL
      ? this.transloco.translate('admin.billing.filter_all')
      : this.transloco.translate(`billing.status.${status}`);

  readonly hasFilters = computed(
    () => this.searchControl.value.length > 0 || this.statusControl.value !== ALL
  );

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load(0));

    this.statusControl.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load(0));
  }

  ngOnInit(): void {
    this.load(0);
  }

  load(page: number): void {
    const status = this.statusControl.value;

    this.loading.set(true);
    this.api
      .list({
        status: status === ALL ? null : (status as BillingStatus),
        q: this.searchControl.value || null,
        page,
        size: PAGE_SIZE,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (result) => {
          this.tenants.set(result.content);
          this.page.set(result.page.number);
          this.total.set(result.page.totalElements);
        },
        error: (error) => {
          this.tenants.set([]);
          this.total.set(0);
          this.notify.error(billingErrorMessage(this.transloco, error));
        },
      });
  }

  open(tenant: TenantBillingAdminDto): void {
    this.router.navigate(['/admin/billing', tenant.tenantId]);
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue(ALL);
  }

  statusAppearance(status: BillingStatus): 'positive' | 'negative' | 'warning' | 'info' | 'neutral' {
    switch (status) {
      case 'ACTIVE':
        return 'positive';
      case 'EXEMPT':
        return 'info';
      case 'TRIAL':
        return 'warning';
      case 'PAST_DUE':
      case 'SUSPENDED':
        return 'negative';
      default:
        return 'neutral';
    }
  }

  /** La fecha que importa en cada estado: prueba, gracia o periodo pagado. */
  milestone(tenant: TenantBillingAdminDto): string | null {
    switch (tenant.billingStatus) {
      case 'TRIAL':
        return tenant.trialEndsAt;
      case 'PAST_DUE':
        return tenant.graceEndsAt;
      case 'SUSPENDED':
        return tenant.suspendedAt;
      default:
        return tenant.paidUntil;
    }
  }

  formatMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(cents / 100);
  }
}
