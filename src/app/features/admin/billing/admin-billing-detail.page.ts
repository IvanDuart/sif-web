import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';

import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiInput, TuiLabel, TuiTextfield, TuiLoader } from '@taiga-ui/core';
import { TuiBadge, TuiSwitch } from '@taiga-ui/kit';

import { PlatformBillingService } from '../../../core/api/services/platform-billing.api';
import {
  BillingInvoice,
  BillingStatus,
  SubscriptionEvent,
  TenantBillingAdminDto,
} from '../../../core/api/models/billing.model';
import { billingErrorMessage } from '../../../core/billing/billing-error';
import { ConfirmService, NotificationService } from '../../../core/ui';
import { EmptyState } from '../../../shared/ui/empty-state';
import { PaginationFooter } from '../../../shared/ui/pagination-footer';

const HISTORY_PAGE_SIZE = 10;

/**
 * Un centro exento no paga: marcarlo como tal exige dejar dicho por qué, y el
 * backend responde `400` sin ello. Se valida también aquí para no gastar un
 * viaje y para que el aviso salga junto al campo.
 */
export function reasonRequiredWhenExempt(group: AbstractControl): ValidationErrors | null {
  const exempt = group.get('billingExempt')?.value === true;
  const reason = (group.get('reason')?.value ?? '').trim();
  return exempt && !reason ? { reasonRequired: true } : null;
}

/**
 * Ficha de facturación de un centro para el superadmin: configuración,
 * overrides manuales, histórico de eventos y facturas.
 *
 * Cuelga de `/admin`, que ya exige `MANAGE_TENANT` y centro administrador.
 */
@Component({
  selector: 'app-admin-billing-detail-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    TranslocoDirective,
    TuiTable,
    TuiButton,
    TuiInput,
    TuiLabel,
    TuiTextfield,
    TuiLoader,
    TuiBadge,
    TuiSwitch,
    EmptyState,
    PaginationFooter,
  ],
  templateUrl: './admin-billing-detail.page.html',
})
export default class AdminBillingDetailPage implements OnInit {
  /** Llega de la ruta `/admin/billing/:tenantId` (`withComponentInputBinding`). */
  readonly tenantId = input.required<string>();

  private readonly api = inject(PlatformBillingService);
  private readonly fb = inject(FormBuilder);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  readonly billing = signal<TenantBillingAdminDto | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  readonly events = signal<SubscriptionEvent[]>([]);
  readonly eventsPage = signal(0);
  readonly eventsTotal = signal(0);

  readonly invoices = signal<BillingInvoice[]>([]);
  readonly invoicesPage = signal(0);
  readonly invoicesTotal = signal(0);

  readonly pageSize = HISTORY_PAGE_SIZE;

  /** Configuración (`PUT /tenants/{id}/billing`). El precio se edita en euros. */
  readonly form = this.fb.nonNullable.group(
    {
      billingExempt: [false],
      price: [25, [Validators.required, Validators.min(0)]],
      trialDays: [14, [Validators.min(0)]],
      billingEmail: [''],
      reason: [''],
    },
    { validators: reasonRequiredWhenExempt }
  );

  /** Motivo y días de los overrides manuales, separados del formulario de config. */
  readonly overrideForm = this.fb.nonNullable.group({
    days: [14, [Validators.min(1)]],
    reason: [''],
  });

  readonly isSuspended = computed(() => this.billing()?.billingStatus === 'SUSPENDED');
  readonly busy = computed(() => this.saving() || this.loading());

  ngOnInit(): void {
    this.load();
    this.loadEvents(0);
    this.loadInvoices(0);
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .get(this.tenantId())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (billing) => this.apply(billing),
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  private apply(billing: TenantBillingAdminDto): void {
    this.billing.set(billing);
    this.form.patchValue({
      billingExempt: billing.billingExempt,
      price: billing.priceCents / 100,
      billingEmail: billing.billingEmail ?? '',
      reason: '',
    });
    this.form.markAsPristine();
  }

  // ── Configuración ───────────────────────────────────────────────────────

  save(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .update(this.tenantId(), {
        billingExempt: value.billingExempt,
        // El contrato habla en céntimos; el formulario, en euros.
        priceCents: Math.round(value.price * 100),
        trialDays: value.trialDays,
        billingEmail: value.billingEmail || undefined,
        reason: value.reason || undefined,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (billing) => {
          this.apply(billing);
          this.notify.success(this.transloco.translate('admin.billing.toast.saved'));
          this.loadEvents(0);
        },
        error: (error: HttpErrorResponse) => this.showError(error),
      });
  }

  // ── Overrides manuales ──────────────────────────────────────────────────

  startTrial(): void {
    const { days, reason } = this.overrideForm.getRawValue();
    this.runOverride(
      this.transloco.translate('admin.billing.confirm.trial', { days }),
      () => this.api.startTrial(this.tenantId(), { days, reason: reason || undefined }),
      'admin.billing.toast.trial_started'
    );
  }

  suspend(): void {
    const reason = this.overrideForm.getRawValue().reason.trim();
    if (!reason) {
      // Cortarle el acceso a un centro sin dejar dicho por qué no es aceptable.
      this.notify.warning(this.transloco.translate('admin.billing.reason_required'));
      return;
    }

    this.runOverride(
      this.transloco.translate('admin.billing.confirm.suspend', {
        tenant: this.billing()?.tenantName ?? '',
      }),
      () => this.api.suspend(this.tenantId(), { reason }),
      'admin.billing.toast.suspended'
    );
  }

  reactivate(): void {
    const reason = this.overrideForm.getRawValue().reason;
    this.runOverride(
      this.transloco.translate('admin.billing.confirm.reactivate'),
      () => this.api.reactivate(this.tenantId(), { reason: reason || undefined }),
      'admin.billing.toast.reactivated'
    );
  }

  private runOverride(
    question: string,
    call: () => ReturnType<PlatformBillingService['suspend']>,
    successKey: string
  ): void {
    if (this.saving()) return;

    this.confirm
      .confirm({
        label: this.transloco.translate('admin.billing.override_title'),
        content: question,
        yes: this.transloco.translate('common.accept'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.saving.set(true);
        call()
          .pipe(finalize(() => this.saving.set(false)))
          .subscribe({
            next: (billing) => {
              this.apply(billing);
              this.overrideForm.patchValue({ reason: '' });
              this.notify.success(this.transloco.translate(successKey));
              this.loadEvents(0);
            },
            error: (error: HttpErrorResponse) => this.showError(error),
          });
      });
  }

  // ── Histórico ───────────────────────────────────────────────────────────

  loadEvents(page: number): void {
    this.api.events(this.tenantId(), page, HISTORY_PAGE_SIZE).subscribe({
      next: (result) => {
        this.events.set(result.content);
        this.eventsPage.set(result.page.number);
        this.eventsTotal.set(result.page.totalElements);
      },
      error: () => {
        this.events.set([]);
        this.eventsTotal.set(0);
      },
    });
  }

  loadInvoices(page: number): void {
    this.api.invoices(this.tenantId(), page, HISTORY_PAGE_SIZE).subscribe({
      next: (result) => {
        this.invoices.set(result.content);
        this.invoicesPage.set(result.page.number);
        this.invoicesTotal.set(result.page.totalElements);
      },
      error: () => {
        this.invoices.set([]);
        this.invoicesTotal.set(0);
      },
    });
  }

  // ── Presentación ────────────────────────────────────────────────────────

  statusAppearance(status: BillingStatus | undefined): 'positive' | 'negative' | 'warning' | 'info' | 'neutral' {
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

  /**
   * Etiqueta del evento. El backend puede añadir tipos nuevos, así que un tipo
   * sin traducción se enseña en crudo en vez de dejar la clave a la vista.
   */
  eventLabel(type: string): string {
    const key = `admin.billing.events.${type}`;
    const translated = this.transloco.translate<string>(key);
    return translated && translated !== key ? translated : type;
  }

  eventIcon(type: string): string {
    if (type.startsWith('PAYMENT_FAILED') || type === 'SUSPENDED') return 'fa-solid fa-circle-xmark text-err-text';
    if (type === 'PAYMENT_SUCCEEDED' || type === 'REACTIVATED' || type === 'CHECKOUT_COMPLETED')
      return 'fa-solid fa-circle-check text-ok';
    if (type.startsWith('GRACE') || type.startsWith('TRIAL')) return 'fa-solid fa-hourglass-half text-warn-text';
    return 'fa-solid fa-circle-info text-surface-400';
  }

  /** `metadata` es JSON libre: se enseña tal cual, sin inventarle forma. */
  eventMetadata(event: SubscriptionEvent): string | null {
    const metadata = event.metadata;
    if (!metadata || Object.keys(metadata).length === 0) return null;
    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
  }

  formatMoney(cents: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang(), {
      style: 'currency',
      currency: currency || 'EUR',
    }).format(cents / 100);
  }

  private showError(error: HttpErrorResponse): void {
    this.notify.error(billingErrorMessage(this.transloco, error));
  }
}
