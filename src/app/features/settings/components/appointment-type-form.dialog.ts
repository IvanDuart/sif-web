import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TuiTextfield } from '@taiga-ui/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiDialogContext } from '@taiga-ui/core';
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
  imports: [FormsModule, TuiTextfield],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <tui-textfield>
          <label tuiLabel>Nombre</label>
          <input
            tuiTextfield
            [(ngModel)]="name"
            placeholder="Ej: Primera consulta" />
        </tui-textfield>
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="duration" class="text-sm font-medium text-surface-700">Duración (minutos)</label>
        <input
          id="duration"
          type="number"
          [(ngModel)]="durationMinutes"
          min="1"
          max="480"
          step="5"
          class="form-input" />
      </div>

      <div class="flex items-center gap-2 mt-1">
        <label class="switch">
          <input type="checkbox" [(ngModel)]="isDefault" role="switch" />
          <span class="switch-slider"></span>
        </label>
        <label class="text-sm font-medium text-surface-700 cursor-pointer">Tipo predeterminado</label>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <button
          class="btn-secondary"
          (click)="context.$implicit.complete()">
          Cancelar
        </button>
        <button
          class="btn-primary"
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
