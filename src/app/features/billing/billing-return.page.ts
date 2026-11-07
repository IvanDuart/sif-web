import { Component, DestroyRef, OnInit, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { timer } from 'rxjs';

import { TuiButton, TuiLoader } from '@taiga-ui/core';

import { BillingService } from '../../core/api/services/billing.api';
import { BillingStatusService } from '../../core/billing/billing-status.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

/** Espera a que el webhook de Stripe llegue antes de dar la vuelta por mala. */
const WEBHOOK_RETRY_MS = 2000;

type ReturnState = 'checking' | 'active' | 'pending' | 'cancelled';

/**
 * Vuelta desde la pasarela de Stripe (`/billing/success` y `/billing/cancel`).
 *
 * El `success_url` se visita antes de que el webhook haya aterrizado, así que
 * el estado puede seguir siendo el viejo: se reintenta una vez a los 2 s antes
 * de decir nada, tal y como pide el contrato.
 */
@Component({
  selector: 'app-billing-return-page',
  standalone: true,
  imports: [RouterLink, TranslocoDirective, TuiButton, TuiLoader],
  templateUrl: './billing-return.page.html',
})
export default class BillingReturnPage implements OnInit {
  /** Llega por `data` de la ruta (`withComponentInputBinding`). */
  readonly outcome = input<'success' | 'cancel'>('success');

  private readonly billingApi = inject(BillingService);
  private readonly billing = inject(BillingStatusService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<ReturnState>('checking');

  ngOnInit(): void {
    if (this.outcome() === 'cancel') {
      this.state.set('cancelled');
      return;
    }
    this.check(true);
  }

  private check(allowRetry: boolean): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) {
      this.state.set('pending');
      return;
    }

    this.billingApi
      .status(tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.billing.setDetail(detail);
          if (detail.status === 'ACTIVE') {
            this.state.set('active');
            return;
          }
          if (allowRetry) {
            this.retryLater();
            return;
          }
          this.state.set('pending');
        },
        error: () => {
          if (allowRetry) {
            this.retryLater();
            return;
          }
          this.state.set('pending');
        },
      });
  }

  private retryLater(): void {
    timer(WEBHOOK_RETRY_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.check(false));
  }
}
