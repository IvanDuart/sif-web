import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AppointmentTypeService } from '../../../core/api/services/appointment-type.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { AppointmentTypeDto } from '../../../core/api/models/appointment-type.model';
import { AppointmentTypeFormDialog } from './appointment-type-form.dialog';

@Component({
  selector: 'app-appointment-types-settings',
  standalone: true,
  imports: [CommonModule, TableModule, ButtonModule, TagModule, TooltipModule, ConfirmDialogModule, TranslocoDirective],
  providers: [DialogService, ConfirmationService],
  template: `
    <div *transloco="let t">
      <div class="flex justify-end mb-4">
        <p-button
          [label]="t('appointment_types.create')"
          icon="fa-solid fa-plus"
          size="small"
          (onClick)="showFormDialog()">
        </p-button>
      </div>

      <p-table
        [value]="types()"
        [loading]="loading()"
        [rowHover]="true"
        responsiveLayout="scroll"
        styleClass="p-datatable-sm">
        <ng-template pTemplate="header">
          <tr>
            <th scope="col">{{ t('appointment_types.name') }}</th>
            <th scope="col">{{ t('appointment_types.duration') }}</th>
            <th scope="col">{{ t('appointment_types.is_default') }}</th>
            <th scope="col">{{ t('appointment_types.is_active') }}</th>
            <th scope="col" style="width: 8rem;">{{ t('common.actions') }}</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-type>
          <tr>
            <td class="font-medium">{{ type.name }}</td>
            <td>{{ type.durationMinutes }} min</td>
            <td>
              @if (type.isDefault) {
                <i class="fa-solid fa-check text-green-500"></i>
              }
            </td>
            <td>
              <p-tag
                [severity]="type.isActive ? 'success' : 'secondary'"
                [value]="type.isActive ? 'Activo' : 'Inactivo'">
              </p-tag>
            </td>
            <td>
              <div class="flex gap-1">
                <p-button
                  icon="fa-solid fa-pen-to-square"
                  [text]="true"
                  [rounded]="true"
                  severity="secondary"
                  [title]="t('common.edit')"
                  (onClick)="showFormDialog(type)">
                </p-button>
                <p-button
                  icon="fa-solid fa-trash"
                  [text]="true"
                  [rounded]="true"
                  severity="danger"
                  [title]="t('common.delete')"
                  (onClick)="confirmDelete(type)">
                </p-button>
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr>
            <td colspan="5" class="text-center text-surface-400 py-8">
              {{ t('appointment_types.empty') }}
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `
})
export class AppointmentTypesSettings implements OnInit {
  private readonly appointmentTypeService = inject(AppointmentTypeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
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
    const ref = this.dialogService.open(AppointmentTypeFormDialog, {
      header: type ? this.transloco.translate('appointment_types.edit') : this.transloco.translate('appointment_types.create'),
      width: '450px',
      modal: true,
      data: type ? { appointmentType: type } : undefined,
      breakpoints: { '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) this.loadTypes();
      });
    }
  }

  confirmDelete(type: AppointmentTypeDto) {
    this.confirmationService.confirm({
      message: this.transloco.translate('appointment_types.delete_confirm', { name: type.name }),
      header: this.transloco.translate('common.attention'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.no'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.appointmentTypeService.delete(tenantId, type.id).subscribe({
            next: () => {
              this.messageService.add({ severity: 'success', summary: 'Éxito', detail: this.transloco.translate('appointment_types.delete_success') });
              this.loadTypes();
            }
          });
        }
      }
    });
  }
}
