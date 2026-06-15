import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { DynamicDialogRef, DynamicDialogConfig } from 'primeng/dynamicdialog';
import { MessageService } from 'primeng/api';
import { AppointmentTypeService } from '../../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AppointmentTypeDto } from '../../../core/api/models/appointment-type.model';

@Component({
  selector: 'app-appointment-type-form-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, InputNumberModule, ToggleSwitchModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="name" class="text-sm font-medium text-surface-700">Nombre</label>
        <input
          id="name"
          pInputText
          [(ngModel)]="name"
          placeholder="Ej: Primera consulta"
          class="w-full" />
      </div>

      <div class="flex flex-col gap-1.5">
        <label for="duration" class="text-sm font-medium text-surface-700">Duración (minutos)</label>
        <p-inputNumber
          id="duration"
          [(ngModel)]="durationMinutes"
          [min]="1"
          [max]="480"
          [showButtons]="true"
          [step]="5"
          class="w-full">
        </p-inputNumber>
      </div>

      <div class="flex items-center gap-2 mt-1">
        <p-toggleSwitch [(ngModel)]="isDefault" [inputId]="'isDefault'" />
        <label for="isDefault" class="text-sm font-medium text-surface-700 cursor-pointer">Tipo predeterminado</label>
      </div>

      <div class="flex justify-end gap-2 mt-2">
        <p-button
          [label]="'Cancelar'"
          severity="secondary"
          [text]="true"
          (onClick)="ref.close()">
        </p-button>
        <p-button
          [label]="editing ? 'Actualizar' : 'Crear'"
          [disabled]="!name || !durationMinutes"
          (onClick)="save()">
        </p-button>
      </div>
    </div>
  `
})
export class AppointmentTypeFormDialog {
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly messageService = inject(MessageService);
  readonly ref = inject(DynamicDialogRef);
  readonly config = inject(DynamicDialogConfig);

  editing = false;
  typeId: string | null = null;
  name = '';
  durationMinutes: number | null = null;
  isDefault = false;

  constructor() {
    const data = this.config.data;
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
        this.messageService.add({
          severity: 'success',
          summary: 'Éxito',
          detail: this.editing ? 'Tipo de cita actualizado' : 'Tipo de cita creado'
        });
        this.ref.close(true);
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'No se pudo guardar el tipo de cita'
        });
      }
    });
  }
}
