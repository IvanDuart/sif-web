import { Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { TranslocoDirective } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';

import { BillingStatusService } from '../../core/billing/billing-status.service';

type BannerTone = 'info' | 'warn' | 'err';

interface BannerCopy {
  tone: BannerTone;
  icon: string;
  messageKey: string;
  /** Parámetros de interpolación del mensaje; `date` lo pone la plantilla. */
  params: { days?: number };
  ctaKey: string;
}

/** A partir de aquí la prueba se avisa en rojo suave, no en informativo. */
const TRIAL_URGENT_DAYS = 3;

/**
 * Aviso de suscripción en la cabecera de la app.
 *
 * Se pinta solo para `TRIAL`, `PAST_DUE` y `CANCELLED`: `ACTIVE` y `EXEMPT` no
 * tienen nada que decir y `SUSPENDED` ocupa la pantalla entera en `/billing`.
 * Tampoco se pinta dentro de `/billing`, donde el estado ya se ve en grande.
 *
 * Contrato: `doc/contrato-api/billing/billing-frontend.md` §6.
 */
@Component({
  selector: 'app-billing-banner',
  standalone: true,
  imports: [RouterLink, TuiButton, TranslocoDirective, DatePipe],
  templateUrl: './billing-banner.html',
  styles: [':host { display: block; }'],
})
export class BillingBanner {
  private readonly billing = inject(BillingStatusService);
  private readonly router = inject(Router);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: this.router.url }
  );

  private readonly onBillingPage = computed(() => this.url().startsWith('/billing'));

  readonly paidUntil = this.billing.paidUntil;

  readonly copy = computed<BannerCopy | null>(() => {
    if (!this.billing.showBanner() || this.onBillingPage()) return null;

    const days = this.billing.daysLeft();

    switch (this.billing.status()) {
      case 'TRIAL':
        // Sin `daysLeft` (detalle aún sin cargar) se avisa en genérico antes
        // que inventar una cuenta atrás en el cliente.
        if (days === null) {
          return {
            tone: 'info',
            icon: 'fa-solid fa-hourglass-half',
            messageKey: 'billing.banner.trial',
            params: {},
            ctaKey: 'billing.banner.cta_add_payment',
          };
        }
        return {
          tone: days <= TRIAL_URGENT_DAYS ? 'warn' : 'info',
          icon: 'fa-solid fa-hourglass-half',
          messageKey: days === 1 ? 'billing.banner.trial_ending_one' : 'billing.banner.trial_ending_other',
          params: { days },
          ctaKey: 'billing.banner.cta_add_payment',
        };

      case 'PAST_DUE':
        return {
          tone: 'err',
          icon: 'fa-solid fa-triangle-exclamation',
          messageKey:
            days === null
              ? 'billing.banner.past_due'
              : days === 1
                ? 'billing.banner.past_due_one'
                : 'billing.banner.past_due_other',
          params: days === null ? {} : { days },
          ctaKey: 'billing.banner.cta_update_card',
        };

      case 'CANCELLED':
        return {
          tone: 'info',
          icon: 'fa-solid fa-circle-info',
          messageKey: this.paidUntil() ? 'billing.banner.cancelled_until' : 'billing.banner.cancelled',
          params: {},
          ctaKey: 'billing.banner.cta_reactivate',
        };

      default:
        return null;
    }
  });

  readonly toneClasses = computed(() => {
    switch (this.copy()?.tone) {
      case 'err':
        return 'bg-err-soft text-err-text border-err/25';
      case 'warn':
        return 'bg-warn-soft text-warn-text border-warn/25';
      default:
        return 'bg-accent-soft text-accent border-accent/20';
    }
  });
}
