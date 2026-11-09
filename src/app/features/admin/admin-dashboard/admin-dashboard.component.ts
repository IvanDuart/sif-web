import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { TuiButton, TuiInput, TuiLabel, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiChevron, TuiDataListWrapper, TuiSelect } from '@taiga-ui/kit';
import { TuiTable } from '@taiga-ui/addon-table';
import { TenantService } from '../../../core/api/services/tenant.api';
import { PlatformBillingService } from '../../../core/api/services/platform-billing.api';
import { Tenant } from '../../../core/api/models/tenant.model';
import { Page } from '../../../core/api/models/page.model';
import {
  BILLING_STATUSES,
  BillingStatus,
  TenantBillingAdminDto,
} from '../../../core/api/models/billing.model';
import { AuthService } from '../../../core/auth/auth.service';
import { superAdminMembership } from '../../../core/api/models/user.model';
import { NotificationService, ModalService } from '../../../core/ui';
import { EmptyState } from '../../../shared/ui/empty-state';
import { CreateTenantDialog } from '../create-tenant.dialog';

/** Opción «todos» del filtro de estado. No es un `BillingStatus` real. */
const ALL = 'ALL';

/**
 * Fila del listado unificado: las propiedades completas del `Tenant` más lo
 * que solo el panel de facturación conoce (`stripeCustomerId` y el precio
 * exacto de la plataforma).
 */
export type AdminTenantRow = Tenant & {
  priceCents?: number;
  stripeCustomerId?: string | null;
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslocoDirective,
    RouterLink,
    TuiButton,
    TuiInput,
    TuiLabel,
    TuiTextfield,
    TuiBadge,
    TuiChevron,
    TuiDataListWrapper,
    TuiSelect,
    TuiTable,
    EmptyState,
  ],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  private readonly tenantService = inject(TenantService);
  private readonly billingApi = inject(PlatformBillingService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  readonly tenants = signal<AdminTenantRow[]>([]);
  readonly loading = signal(false);
  readonly totalRecords = signal(0);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<string>(ALL, { nonNullable: true });

  readonly statusOptions = [ALL, ...BILLING_STATUSES];

  /**
   * El filtrado es en cliente: el listado completo cabe en una página y así el
   * buscador responde sin un viaje por tecla.
   */
  private readonly searchValue = toSignal(this.searchControl.valueChanges, {
    initialValue: this.searchControl.value,
  });
  private readonly statusValue = toSignal(this.statusControl.valueChanges, {
    initialValue: this.statusControl.value,
  });

  readonly hasFilters = computed(
    () => this.searchValue().trim().length > 0 || this.statusValue() !== ALL
  );

  readonly filtered = computed(() => {
    const query = this.searchValue().trim().toLowerCase();
    const status = this.statusValue();

    return this.tenants().filter((tenant) => {
      if (status !== ALL && tenant.billingStatus !== status) return false;
      if (!query) return true;
      return [tenant.name, tenant.cif, tenant.city, tenant.phone, tenant.billingEmail].some(
        (value) => (value ?? '').toLowerCase().includes(query)
      );
    });
  });

  /** Etiqueta de cada opción del desplegable; la usa Taiga para pintar y buscar. */
  readonly statusStringify = (status: string): string =>
    status === ALL
      ? this.transloco.translate('admin.billing.filter_all')
      : this.transloco.translate(`billing.status.${status}`);

  ngOnInit(): void {
    this.loadTenants();
  }

  /**
   * El listado de centros es la fuente principal; la facturación solo lo
   * enriquece. Si `/billing` falla (o está deshabilitada en el backend), el
   * `Tenant` ya trae sus propios `TenantBillingFields` y la tabla se pinta
   * igualmente.
   */
  loadTenants(): void {
    this.loading.set(true);
    forkJoin({
      tenants: this.tenantService.search(0, 100),
      billing: this.billingApi
        .list({ page: 0, size: 100 })
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ tenants, billing }) => {
        this.tenants.set(this.merge(tenants, billing?.content ?? []));
        this.totalRecords.set(tenants.page?.totalElements ?? tenants.content?.length ?? 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private merge(
    page: Page<Tenant>,
    billing: readonly TenantBillingAdminDto[]
  ): AdminTenantRow[] {
    const byTenantId = new Map(billing.map((dto) => [dto.tenantId, dto]));
    return (page.content ?? []).map((tenant) => {
      const dto = byTenantId.get(tenant.id);
      return {
        ...tenant,
        billingStatus: dto?.billingStatus ?? tenant.billingStatus,
        billingExempt: dto?.billingExempt ?? tenant.billingExempt,
        priceCents: dto?.priceCents ?? tenant.subscriptionPriceCents,
        trialEndsAt: dto?.trialEndsAt ?? tenant.trialEndsAt,
        paidUntil: dto?.paidUntil ?? tenant.paidUntil,
        graceEndsAt: dto?.graceEndsAt ?? tenant.graceEndsAt,
        suspendedAt: dto?.suspendedAt ?? tenant.suspendedAt,
        cancelAtPeriodEnd: dto?.cancelAtPeriodEnd ?? tenant.cancelAtPeriodEnd,
        stripeCustomerId: dto?.stripeCustomerId ?? null,
        billingEmail: dto?.billingEmail ?? tenant.billingEmail,
        currency: dto?.currency ?? tenant.currency ?? 'EUR',
        preferences: tenant.preferences,
      };
    });
  }

  clearFilters(): void {
    this.searchControl.setValue('');
    this.statusControl.setValue(ALL);
  }

  open(tenant: AdminTenantRow): void {
    this.router.navigate(['/admin', tenant.id]);
  }

  /** Solo abre la ficha si el Enter se pulsó sobre la propia fila/tarjeta. */
  openFromKeyboard(tenant: AdminTenantRow, event: Event): void {
    if (event.target !== event.currentTarget) return;
    this.open(tenant);
  }

  enterTenant(tenant: AdminTenantRow, event: Event): void {
    event.stopPropagation();
    this.authService.enterTenant(superAdminMembership(tenant.id, tenant.name ?? ''));
  }

  statusAppearance(
    status: BillingStatus | undefined
  ): 'positive' | 'negative' | 'warning' | 'info' | 'neutral' {
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
  milestone(tenant: AdminTenantRow): string | null {
    switch (tenant.billingStatus) {
      case 'TRIAL':
        return tenant.trialEndsAt ?? null;
      case 'PAST_DUE':
        return tenant.graceEndsAt ?? null;
      case 'SUSPENDED':
        return tenant.suspendedAt ?? null;
      default:
        return tenant.paidUntil ?? null;
    }
  }

  formatMoney(cents: number | undefined, currency: string | undefined): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format((cents ?? 0) / 100);
  }

  showCreateDialog(): void {
    this.modal.open<Tenant | null, void>(CreateTenantDialog, {
      label: this.transloco.translate('admin.create_tenant'),
      size: 'm',
    }).subscribe((created) => {
      if (created) {
        this.notify.success(this.transloco.translate('admin.created_success'));
        this.handleTenantCreated(created);
      }
    });
  }

  private async handleTenantCreated(created: Tenant) {
    const user = await this.authService.refreshUser();
    // El superadmin nunca queda de alta en el centro que crea: entra con la
    // membresía sintética, igual que desde la pantalla de selección.
    const membership = user?.superAdmin
      ? superAdminMembership(created.id, created.name ?? '')
      : user?.memberships?.find((m) => m.tenantId === created.id);
    if (membership) {
      this.authService.switchTenant(membership);
      this.router.navigate(['/dashboard']);
    } else {
      this.loadTenants();
    }
  }
}
