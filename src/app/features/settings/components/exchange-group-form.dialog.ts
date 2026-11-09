import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiError, TuiInput, TuiLabel, TuiTextfield } from '@taiga-ui/core';
import { TuiInputColor } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ExchangeService } from '../../../core/api/services/exchange.api';
import { ExchangeGroupDto } from '../../../core/api/models/exchange.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';

@Component({
  selector: 'app-exchange-group-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    TuiInput,
    TuiTextfield,
    TuiLabel,
    TuiButton,
    TuiError,
    TuiInputColor,
  ],
  templateUrl: './exchange-group-form.dialog.html',
})
export class ExchangeGroupFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly exchangeService = inject(ExchangeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<ExchangeGroupDto | null>>();

  readonly saving = signal(false);

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(12)]],
    name: ['', [Validators.required, Validators.maxLength(80)]],
    colorHex: ['#22c55e'],
  });

  save(): void {
    if (this.saving()) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.exchangeService.createGroup(tenantId, {
      code: (raw.code as string).trim().toUpperCase(),
      name: (raw.name as string).trim(),
      colorHex: raw.colorHex || null,
    }).subscribe({
      next: (group) => {
        this.notify.success(this.transloco.translate('exchange.group_created'));
        this.context.$implicit.next(group);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('exchange.save_error'));
      },
    });
  }
}
