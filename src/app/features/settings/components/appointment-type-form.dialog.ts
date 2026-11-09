import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TuiButton, TuiDialogContext, TuiError, TuiInput, TuiLabel, TuiTextfield } from '@taiga-ui/core';
import { TuiInputColor, TuiSwitch } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AppointmentTypeService } from '../../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { AppointmentTypeDto } from '../../../core/api/models/appointment-type.model';
import { formAccess } from '../../assistant/mascot/fill/descriptor';
import { MascotFillService } from '../../assistant/mascot/fill/mascot-fill.service';
import { APPOINTMENT_TYPE_SURFACE } from '../../assistant/mascot/fill/surfaces/appointment-type.surface';

export interface AppointmentTypeFormDialogInput {
  appointmentType?: AppointmentTypeDto;
}

@Component({
  selector: 'app-appointment-type-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslocoDirective,
    TuiInput,
    TuiTextfield,
    TuiLabel,
    TuiButton,
    TuiSwitch,
    TuiError,
    TuiInputColor,
  ],
  templateUrl: './appointment-type-form.dialog.html'
})
export class AppointmentTypeFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<boolean, AppointmentTypeFormDialogInput>>();

  readonly saving = signal(false);
  readonly editing = signal(false);
  private typeId: string | null = null;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    durationMinutes: [null as number | null, [Validators.required, Validators.min(1), Validators.max(480)]],
    price: [null as number | null, [Validators.min(0)]],
    isDefault: [false],
    color: ['#3B82F6', Validators.required],
  });

  constructor() {
    // Mientras el diálogo esté abierto, la mascota puede rellenarlo.
    inject(MascotFillService).register(APPOINTMENT_TYPE_SURFACE, formAccess(this.form));

    const data = this.context.data;
    if (data?.appointmentType) {
      const at: AppointmentTypeDto = data.appointmentType;
      this.editing.set(true);
      this.typeId = at.id;
      this.form.patchValue({
        name: at.name,
        durationMinutes: at.durationMinutes,
        price: at.price,
        isDefault: at.isDefault,
        color: at.color || '#3B82F6',
      });
    }
  }

  save() {
    if (this.saving()) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    const request = {
      name: raw.name as string,
      durationMinutes: raw.durationMinutes as number,
      price: raw.price ?? 0,
      isDefault: raw.isDefault ?? false,
      color: raw.color || '#3B82F6',
    };

    const isEditing = this.editing() && !!this.typeId;
    const obs = isEditing
      ? this.appointmentTypeService.update(tenantId, this.typeId as string, request)
      : this.appointmentTypeService.create(tenantId, request);

    this.saving.set(true);
    obs.subscribe({
      next: () => {
        this.notify.success(
          this.transloco.translate(
            isEditing ? 'appointment_types.update_success' : 'appointment_types.create_success'
          )
        );
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(this.transloco.translate('common.error'));
      }
    });
  }
}
