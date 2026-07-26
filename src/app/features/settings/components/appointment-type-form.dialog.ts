import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiInput, TuiTextfield, TuiLabel, TuiButton, TuiDialogContext } from '@taiga-ui/core';
import { TuiSwitch } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';
import { AppointmentTypeService } from '../../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { AppointmentTypeDto } from '../../../core/api/models/appointment-type.model';

export interface AppointmentTypeFormDialogInput {
  appointmentType?: AppointmentTypeDto;
}

@Component({
  selector: 'app-appointment-type-form-dialog',
  standalone: true,
  imports: [FormsModule, TuiInput, TuiTextfield, TuiLabel, TuiButton, TuiSwitch],
  template: `
    <div class="flex flex-col gap-4 mt-2">
      <tui-textfield class="w-full">
        <label tuiLabel>Nombre</label>
        <input
          tuiInput
          [(ngModel)]="name" />
      </tui-textfield>

      <tui-textfield class="w-full">
        <label tuiLabel>Duración (minutos)</label>
        <input
          tuiInput
          type="number"
          [(ngModel)]="durationMinutes"
          min="1"
          max="480"
          step="5" />
      </tui-textfield>

      <div class="flex items-center gap-3 py-1">
        <input
          id="isDefault"
          type="checkbox"
          tuiSwitch
          [(ngModel)]="isDefault" />
        <label for="isDefault" class="text-sm font-medium text-surface-700 dark:text-surface-300 cursor-pointer">
          Tipo predeterminado
        </label>
      </div>

      <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
        <button
          tuiButton
          appearance="secondary"
          size="m"
          (click)="context.$implicit.complete()">
          Cancelar
        </button>
        <button
          tuiButton
          size="m"
          [disabled]="!name || !durationMinutes"
          (click)="save()">
          {{ editing ? 'Actualizar' : 'Crear' }}
        </button>
      </div>
    </div>
  `
})
export class AppointmentTypeFormDialog {
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  readonly context = injectContext<TuiDialogContext<boolean, AppointmentTypeFormDialogInput>>();

  editing = false;
  typeId: string | null = null;
  name = '';
  durationMinutes: number | null = null;
  isDefault = false;

  constructor() {
    const data = this.context.data;
    if (data?.appointmentType) {
      const at: AppointmentTypeDto = data.appointmentType;
      this.editing = true;
      this.typeId = at.id;
      this.name = at.name;
      this.durationMinutes = at.durationMinutes;
      this.isDefault = at.isDefault;
    }
  }

  save() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.name || !this.durationMinutes) return;

    const request = {
      name: this.name,
      durationMinutes: this.durationMinutes,
      isDefault: this.isDefault
    };

    const obs = this.editing && this.typeId
      ? this.appointmentTypeService.update(tenantId, this.typeId, request)
      : this.appointmentTypeService.create(tenantId, request);

    obs.subscribe({
      next: () => {
        this.notify.success(this.editing ? 'Tipo de cita actualizado' : 'Tipo de cita creado');
        this.context.$implicit.next(true);
        this.context.$implicit.complete();
      },
      error: () => {
        this.notify.error('No se pudo guardar el tipo de cita');
      }
    });
  }
}
