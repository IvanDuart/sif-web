import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';

import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiLoader } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { BillingService } from '../../core/api/services/billing.api';
import { BillingStatusService } from '../../core/billing/billing-status.service';
import {
  BillingInvoice,
  BillingInvoiceStatus,
  BillingStatus,
} from '../../core/api/models/billing.model';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ConfirmService, NotificationService } from '../../core/ui';
import { problemDetailCode } from '../../core/http/error.interceptor';
import { billingErrorMessage } from '../../core/billing/billing-error';
import { EmptyState } from '../../shared/ui/empty-state';
import { PaginationFooter } from '../../shared/ui/pagination-footer';

const INVOICES_PAGE_SIZE = 10;

type BadgeAppearance = 'positive' | 'negative' | 'warning' | 'info' | 'neutral';

/**
 * Suscripción del centro: estado, método de pago, acciones y facturas.
 *
 * Es la única pantalla que sigue viva con el centro suspendido, así que no
 * asume permisos ni datos: sin `VIEW_BILLING` enseña a quién reclamar, y con el
 * detalle aún sin cargar se apoya en el estado que traen las cabeceras.
 *
 * Contrato: `doc/contrato-api/billing/billing-frontend.md`.
 */
@Component({
  selector: 'app-billing-page',
  standalone: true,
  imports: [
    DatePipe,
    TranslocoDirective,
    TuiTable,
    TuiButton,
    TuiLoader,
    TuiBadge,
    EmptyState,
    PaginationFooter,
  ],
  templateUrl: './billing.page.html',
})
export default class BillingPage implements OnInit {
  private readonly billingApi = inject(BillingService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissions = inject(PermissionsService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  readonly billing = inject(BillingStatusService);

  readonly canManage = computed(() => this.permissions.has('VIEW_BILLING'));
  readonly status = this.billing.status;
  readonly detail = this.billing.statusDetail;
  readonly suspended = this.billing.isSuspended;

  /** Hay una redirección a Stripe o una mutación en vuelo. */
  readonly busy = signal(false);

  readonly invoices = signal<BillingInvoice[]>([]);
  readonly invoicesPage = signal(0);
  readonly invoicesTotal = signal(0);
  readonly invoicesLoading = signal(false);
  readonly invoicesPageSize = INVOICES_PAGE_SIZE;
  readonly downloadingInvoiceId = signal<string | null>(null);

  /** El centro exento no tiene nada que contratar: no se le ofrece pagar. */
  readonly isExempt = computed(() => this.status() === 'EXEMPT' || !!this.detail()?.billingExempt);

  readonly price = computed(() => {
    const detail = this.detail();
    if (!detail) return null;
    return this.formatMoney(detail.priceCents, detail.currency);
  });

  /** Fecha en la que vence la cuenta atrás vigente, si hay alguna. */
  readonly countdownDate = computed(() => {
    const detail = this.detail();
    if (!detail) return null;
    switch (detail.countdownKind) {
      case 'TRIAL':
        return detail.trialEndsAt;
      case 'GRACE':
        return detail.graceEndsAt;
      case 'PAID_UNTIL':
        return detail.paidUntil;
      default:
        return null;
    }
  });

  readonly countdownKey = computed(() => {
    const detail = this.detail();
    if (!detail?.countdownKind) return null;
    const days = detail.daysLeft;
    if (days === null) return `billing.countdown.${detail.countdownKind.toLowerCase()}_date`;
    return days === 1
      ? `billing.countdown.${detail.countdownKind.toLowerCase()}_one`
      : `billing.countdown.${detail.countdownKind.toLowerCase()}_other`;
  });

  /** CTA principal: pagar (checkout) o gestionar la suscripción (portal). */
  readonly primaryActionKey = computed<string | null>(() => {
    if (this.isExempt()) return null;
    switch (this.status()) {
      case 'TRIAL':
        return 'billing.actions.add_payment';
      case 'PAST_DUE':
        return 'billing.actions.update_card';
      case 'SUSPENDED':
        return 'billing.actions.pay';
      case 'ACTIVE':
        return 'billing.actions.manage';
      case 'CANCELLED':
        return 'billing.actions.reactivate';
      default:
        return null;
    }
  });

  ngOnInit(): void {
    if (!this.canManage()) return;
    this.billing.refresh();
    this.loadInvoices(0);
  }

  // ── Acciones ────────────────────────────────────────────────────────────

  /**
   * Un solo botón para todos los estados. El backend es quien decide si toca
   * checkout o portal, así que cada camino cae en el otro ante su `409`/`503`
   * en vez de dejar al usuario con un error y sin salida.
   */
  primaryAction(): void {
    switch (this.status()) {
      case 'ACTIVE':
        this.openPortal();
        break;
      case 'CANCELLED':
        this.reactivate();
        break;
      default:
        this.openCheckout();
    }
  }

  openCheckout(allowPortalFallback = true): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.busy()) return;

    this.busy.set(true);
    this.billingApi.checkout(tenantId).subscribe({
      next: ({ url }) => this.redirectTo(url),
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        // El estado actual no admite checkout (ACTIVE/CANCELLED): es cosa del portal.
        if (allowPortalFallback && problemDetailCode(error) === 'BILLING_CHECKOUT_NOT_ALLOWED') {
          this.openPortal(false);
          return;
        }
        this.showError(error);
      },
    });
  }

  openPortal(allowCheckoutFallback = true): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.busy()) return;

    this.busy.set(true);
    this.billingApi.portal(tenantId).subscribe({
      next: ({ url }) => this.redirectTo(url),
      error: (error: HttpErrorResponse) => {
        this.busy.set(false);
        // Todavía no hay cliente en Stripe: el camino es contratar, no gestionar.
        if (allowCheckoutFallback && problemDetailCode(error) === 'BILLING_CUSTOMER_REQUIRED') {
          this.openCheckout(false);
          return;
        }
        this.showError(error);
      },
    });
  }

  cancelSubscription(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.busy()) return;

    const paidUntil = this.detail()?.paidUntil;
    const content = paidUntil
      ? this.transloco.translate('billing.confirm.cancel_until', {
          date: new Date(paidUntil).toLocaleDateString(this.transloco.getActiveLang()),
        })
      : this.transloco.translate('billing.confirm.cancel');

    this.confirm
      .confirm({
        label: this.transloco.translate('billing.actions.cancel'),
        content,
        yes: this.transloco.translate('billing.actions.cancel_confirm'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.busy.set(true);
        this.billingApi
          .cancel(tenantId)
          .pipe(finalize(() => this.busy.set(false)))
          .subscribe({
            next: (detail) => {
              this.billing.setDetail(detail);
              this.notify.success(this.transloco.translate('billing.toast.cancelled'));
            },
            error: (error: HttpErrorResponse) => this.showError(error),
          });
      });
  }

  reactivate(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.busy()) return;

    this.busy.set(true);
    this.billingApi
      .reactivate(tenantId)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (detail) => {
          this.billing.setDetail(detail);
          this.notify.success(this.transloco.translate('billing.toast.reactivated'));
        },
        error: (error: HttpErrorResponse) => {
          // Reactivar no levanta un centro suspendido: para eso hay que pagar.
          if (problemDetailCode(error) === 'BILLING_INVALID_TRANSITION') {
            this.openCheckout(false);
            return;
          }
          this.showError(error);
        },
      });
  }

  // ── Facturas ────────────────────────────────────────────────────────────

  loadInvoices(page: number): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canManage()) return;

    this.invoicesLoading.set(true);
    this.billingApi
      .invoices(tenantId, page, INVOICES_PAGE_SIZE)
      .pipe(finalize(() => this.invoicesLoading.set(false)))
      .subscribe({
        next: (result) => {
          this.invoices.set(result.content);
          this.invoicesPage.set(result.page.number);
          this.invoicesTotal.set(result.page.totalElements);
        },
        error: () => {
          // El listado es accesorio: si falla, el resto de la pantalla sigue en pie.
          this.invoices.set([]);
          this.invoicesTotal.set(0);
        },
      });
  }

  /**
   * Descarga por el backend (que comprueba el permiso y audita) en vez de por
   * `invoice.pdfUrl`, que es una URL firmada de MinIO sin control de acceso.
   */
  downloadInvoice(invoice: BillingInvoice): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.downloadingInvoiceId()) return;

    this.downloadingInvoiceId.set(invoice.id);
    this.billingApi
      .downloadInvoice(tenantId, invoice.id)
      .pipe(finalize(() => this.downloadingInvoiceId.set(null)))
      .subscribe({
        next: (blob) => this.saveBlob(blob, `${invoice.number ?? invoice.id}.pdf`),
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  // ── Presentación ────────────────────────────────────────────────────────

  statusLabel(): string {
    const status = this.status();
    if (!status) return '';
    // `statusLabel` del backend ya viene traducido; si no hay detalle, el enum.
    return this.detail()?.statusLabel ?? this.transloco.translate(`billing.status.${status}`);
  }

  statusAppearance(status: BillingStatus | null): BadgeAppearance {
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

  invoiceAppearance(status: BillingInvoiceStatus): BadgeAppearance {
    switch (status) {
      case 'PAID':
        return 'positive';
      case 'OPEN':
        return 'warning';
      case 'UNCOLLECTIBLE':
        return 'negative';
      default:
        return 'neutral';
    }
  }

  formatMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(cents / 100);
  }

  cardLabel(): string | null {
    const card = this.detail()?.paymentMethod;
    if (!card) return null;
    const brand = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : '';
    const expiry = `${String(card.expMonth).padStart(2, '0')}/${String(card.expYear).slice(-2)}`;
    return `${brand} ···· ${card.last4} · ${expiry}`;
  }

  // ── Internos ────────────────────────────────────────────────────────────

  private redirectTo(url: string): void {
    // Stripe aloja la pasarela: no hay formulario propio que rellenar.
    window.location.href = url;
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private showError(error: HttpErrorResponse): void {
    this.notify.error(billingErrorMessage(this.transloco, error));
  }
}
