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
  templateUrl: './appointment-types-settings.html'
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
