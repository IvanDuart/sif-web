import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

import { BillingService } from '../api/services/billing.api';
import {
  BILLING_GRACE_ENDS_HEADER,
  BILLING_STATUS_HEADER,
  BILLING_TRIAL_ENDS_HEADER,
  BillingStatus,
  BillingStatusResponse,
  isBillingStatus,
} from '../api/models/billing.model';
import { PermissionsService } from '../permissions/permissions.service';
import { TenantContextService } from '../tenant/tenant-context.service';

/** Estados que pintan banner. `SUSPENDED` no: ocupa la pantalla entera. */
const BANNER_STATES: readonly BillingStatus[] = ['TRIAL', 'PAST_DUE', 'CANCELLED'];

/**
 * Estado de facturación del centro activo, en señales.
 *
 * Tiene dos fuentes que se complementan:
 *
 * - Las cabeceras `X-Billing-*`, que `billingInterceptor` vuelca aquí en **cada**
 *   respuesta bajo `/api/tenant/**`. Son gratis y siempre frescas, pero solo
 *   traen el estado y dos fechas.
 * - `GET /billing/status`, que trae el detalle (`daysLeft`, precio, tarjeta,
 *   facturas). Se pide una vez por centro y se vuelve a pedir **solo** cuando
 *   las cabeceras dicen que el estado cambió, para no llamar en cada navegación.
 */
@Injectable({ providedIn: 'root' })
export class BillingStatusService {
  private readonly billing = inject(BillingService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissions = inject(PermissionsService);

  /** Estado según la última cabecera `X-Billing-Status` vista. */
  private readonly headerStatus = signal<BillingStatus | null>(null);
  private readonly headerTrialEndsAt = signal<string | null>(null);
  private readonly headerGraceEndsAt = signal<string | null>(null);

  /** Detalle de `GET /billing/status` del centro activo. */
  private readonly detail = signal<BillingStatusResponse | null>(null);
  private readonly loadingDetail = signal(false);

  /** URL de renovación que viaja en el `ProblemDetail` del 403 de suspensión. */
  readonly renewalUrl = signal<string | null>(null);

  /** Estado efectivo: manda la cabecera, que es lo más reciente que hemos visto. */
  readonly status = computed<BillingStatus | null>(
    () => this.headerStatus() ?? this.detail()?.status ?? null
  );

  readonly statusDetail = computed(() => {
    const detail = this.detail();
    const tenantId = this.tenantCtx.currentTenantId();
    // Detalle de otro centro (p. ej. justo después de cambiar de centro): no vale.
    if (!detail || !tenantId || detail.tenantId !== tenantId) return null;
    return detail;
  });

  readonly loading = this.loadingDetail.asReadonly();

  readonly isSuspended = computed(() => this.status() === 'SUSPENDED');

  readonly trialEndsAt = computed(
    () => this.statusDetail()?.trialEndsAt ?? this.headerTrialEndsAt()
  );
  readonly graceEndsAt = computed(
    () => this.statusDetail()?.graceEndsAt ?? this.headerGraceEndsAt()
  );

  /**
   * Días naturales UTC que quedan, tal y como los calcula el backend. Solo se
   * usa el valor del detalle si corresponde al estado vigente: si la cabecera
   * ya cambió de `TRIAL` a `PAST_DUE`, la cuenta atrás vieja no sirve.
   */
  readonly daysLeft = computed<number | null>(() => {
    const detail = this.statusDetail();
    if (!detail || detail.status !== this.status()) return null;
    return detail.daysLeft;
  });

  readonly paidUntil = computed(() => this.statusDetail()?.paidUntil ?? null);

  /** Solo quien puede actuar sobre la suscripción ve el aviso. */
  readonly canManageBilling = computed(() => this.permissions.permissions().has('VIEW_BILLING'));

  /** El banner se pinta para `TRIAL`, `PAST_DUE` y `CANCELLED`, nunca para el resto. */
  readonly showBanner = computed(() => {
    const status = this.status();
    return !!status && BANNER_STATES.includes(status) && this.canManageBilling();
  });

  constructor() {
    // Al cambiar de centro el detalle cacheado deja de valer.
    effect(() => {
      const tenantId = this.tenantCtx.currentTenantId();
      const detail = untracked(this.detail);
      if (detail && detail.tenantId !== tenantId) {
        this.detail.set(null);
        this.headerStatus.set(null);
        this.headerTrialEndsAt.set(null);
        this.headerGraceEndsAt.set(null);
        this.renewalUrl.set(null);
      }
    });

    // Pide el detalle la primera vez y cada vez que la cabecera delate un cambio.
    effect(() => {
      const tenantId = this.tenantCtx.currentTenantId();
      const status = this.headerStatus();
      if (!tenantId || !this.canManageBilling()) return;

      const detail = untracked(this.detail);
      const stale = !detail || detail.tenantId !== tenantId || (!!status && detail.status !== status);
      if (stale && !untracked(this.loadingDetail)) {
        this.refresh();
      }
    });
  }

  /** Vuelca las cabeceras `X-Billing-*` de una respuesta. Las ignora si no vienen. */
  readHeaders(headers: HttpHeaders): void {
    const status = headers.get(BILLING_STATUS_HEADER);
    if (!isBillingStatus(status)) return;

    this.headerStatus.set(status);
    this.headerTrialEndsAt.set(headers.get(BILLING_TRIAL_ENDS_HEADER));
    this.headerGraceEndsAt.set(headers.get(BILLING_GRACE_ENDS_HEADER));
  }

  /**
   * Marca el centro como suspendido a partir del `403 TENANT_SUSPENDED`, sin
   * esperar a la siguiente cabecera.
   */
  markSuspended(renewalUrl?: string | null): void {
    this.headerStatus.set('SUSPENDED');
    if (renewalUrl) this.renewalUrl.set(renewalUrl);
  }

  /** Relee `GET /billing/status`. Sin permiso `VIEW_BILLING` el backend responde 403. */
  refresh(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canManageBilling() || this.loadingDetail()) return;

    this.loadingDetail.set(true);
    this.billing.status(tenantId).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.headerStatus.set(detail.status);
        this.loadingDetail.set(false);
      },
      error: () => {
        // Sin detalle seguimos teniendo las cabeceras: el banner degrada solo.
        this.loadingDetail.set(false);
      },
    });
  }

  /** Guarda el detalle que devuelven `cancel`/`reactivate` sin pedirlo otra vez. */
  setDetail(detail: BillingStatusResponse): void {
    this.detail.set(detail);
    this.headerStatus.set(detail.status);
  }
}
