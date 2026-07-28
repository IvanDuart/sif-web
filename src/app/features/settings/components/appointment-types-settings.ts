import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AppointmentTypeService } from '../../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AppointmentTypeDto } from '../../../core/api/models/appointment-type.model';
import { NotificationService, ModalService, ConfirmService } from '../../../core/ui';
import { AppointmentTypeFormDialog } from './appointment-type-form.dialog';
import type { AppointmentTypeFormDialogInput } from './appointment-type-form.dialog';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

@Component({
  selector: 'app-appointment-types-settings',
  standalone: true,
  imports: [TranslocoDirective, TuiTable, TuiButton, TuiBadge],
  template: `
    <div *transloco="let t">
      <div class="flex justify-end mb-4">
        <button
          tuiButton
          size="m"
          (click)="showFormDialog()">
          <i class="fa-solid fa-plus mr-1"></i>
          {{ t('appointment_types.create') }}
        </button>
      </div>

      <div class="data-card">
        @if (loading()) {
          <div class="table-loading">
            <div class="loading-spinner"></div>
          </div>
        }

        <div class="table-wrapper">
          <table tuiTable class="w-full">
            <thead>
              <tr>
                <th tuiTh scope="col">{{ t('appointment_types.name') }}</th>
                <th tuiTh scope="col">{{ t('appointment_types.duration') }}</th>
                <th tuiTh scope="col">{{ t('appointment_types.price') }}</th>
                <th tuiTh scope="col">{{ t('appointment_types.is_default') }}</th>
                <th tuiTh scope="col">{{ t('appointment_types.is_active') }}</th>
                <th tuiTh scope="col" class="text-center" style="width: 8rem;">{{ t('common.actions') }}</th>
              </tr>
            </thead>
            <tbody tuiTbody>
              @for (type of types(); track type.id) {
                <tr tuiTr>
                  <td tuiTd class="font-medium">{{ type.name }}</td>
                  <td tuiTd>{{ type.durationMinutes }} min</td>
                  <td tuiTd>{{ formatPrice(type.price) }}</td>
                  <td tuiTd>
                    @if (type.isDefault) {
                      <i class="fa-solid fa-check text-green-500"></i>
                    }
                  </td>
                  <td tuiTd>
                    <span tuiBadge [appearance]="type.isActive ? 'positive' : 'neutral'">
                      {{ type.isActive ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td tuiTd class="text-center">
                    <div class="flex items-center gap-1 justify-center">
                      <button
                        tuiIconButton
                        appearance="flat"
                        size="s"
                        [title]="t('common.edit')"
                        (click)="showFormDialog(type)">
                        <i class="fa-solid fa-pen"></i>
                      </button>
                      <button
                        tuiIconButton
                        appearance="flat"
                        size="s"
                        class="text-red-500 hover:text-red-700"
                        [title]="t('common.delete')"
                        (click)="confirmDelete(type)">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr tuiTr>
                  <td tuiTd colspan="6" class="text-center text-surface-400 py-8">
                    {{ t('appointment_types.empty') }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `
})
export class AppointmentTypesSettings implements OnInit {
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  types = signal<AppointmentTypeDto[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loadTypes();
  }

  loadTypes() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loading.set(true);
    this.appointmentTypeService.getAll(tenantId, false).subscribe({
      next: (res) => {
        this.types.set(res);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  showFormDialog(type?: AppointmentTypeDto) {
    this.modal.open<boolean, AppointmentTypeFormDialogInput>(AppointmentTypeFormDialog, {
      label: this.transloco.translate(type ? 'appointment_types.edit' : 'appointment_types.create'),
      size: 'm',
      data: type ? { appointmentType: type } : undefined,
    }).subscribe((result) => {
      if (result) this.loadTypes();
    });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(price);
  }

  confirmDelete(type: AppointmentTypeDto) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('appointment_types.delete_confirm', { name: type.name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.appointmentTypeService.delete(tenantId, type.id).subscribe({
          next: () => {
            this.notify.success(this.transloco.translate('appointment_types.delete_success'));
            this.loadTypes();
          }
        });
      }
    });
  }
}
