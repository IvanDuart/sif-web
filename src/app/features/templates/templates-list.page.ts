import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { ConfirmationService, MessageService, type LazyLoadMeta } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';
import { Router } from '@angular/router';
import { TemplateFormDialog } from './template-form.dialog';
import { TemplateUploadDialog } from './template-upload.dialog';
import { InstantiateTemplateDialog } from './instantiate-template.dialog';
import { EmptyState } from '../../shared/ui/empty-state';

import { TranslocoService, TranslocoDirective } from '@jsverse/transloco';

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [CommonModule, TableModule, Button, CardModule, IfPermissionDirective, TranslocoDirective, EmptyState],
  templateUrl: './templates-list.page.html'
})
export default class TemplatesListPage implements OnInit {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
  private readonly dialogService = inject(DialogService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  templates = signal<MenuTemplate[]>([]);
  loading = signal(false);
  totalRecords = signal(0);

  private lastPage = 0;
  private lastSize = 10;

  ngOnInit() {
    this.loadTemplates(0, 10);
  }

  onPage(event: LazyLoadMeta) {
    this.lastPage = (event.first ?? 0) / (event.rows ?? 10);
    this.lastSize = event.rows ?? 10;
    this.loadTemplates(this.lastPage, this.lastSize);
  }

  loadTemplates(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.templateService.search(tenantId, page, size).subscribe({
      next: (res) => {
        this.templates.set(res.content || []);
        this.totalRecords.set(res.page?.totalElements || 0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  createTemplate() {
    const ref = this.dialogService.open(TemplateFormDialog, {
      header: 'Crear Nueva Plantilla',
      width: '450px',
      modal: true,
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Plantilla creada' });
          this.router.navigate(['/templates', result.id]);
        }
      });
    }
  }

  uploadTemplate() {
    const ref = this.dialogService.open(TemplateUploadDialog, {
      header: 'Subir Plantilla (Reconocimiento por IA)',
      width: '550px',
      modal: true,
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.router.navigate(['/templates', result.id]);
        }
      });
    }
  }

  viewTemplate(template: MenuTemplate) {
    this.router.navigate(['/templates', template.id]);
  }

  instantiateTemplate(template: MenuTemplate) {
    const ref = this.dialogService.open(InstantiateTemplateDialog, {
      header: 'Asignar Plantilla a Paciente',
      width: '450px',
      modal: true,
      data: { template },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Menú Creado', detail: 'La plantilla fue instanciada y asignada al paciente.' });
        }
      });
    }
  }

  deleteTemplate(template: MenuTemplate) {
    this.confirmationService.confirm({
      message: this.transloco.translate('templates.delete_confirm_msg', { name: template.name }),
      header: this.transloco.translate('common.attention'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.templateService.delete(tenantId, template.id).subscribe(() => {
            this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Plantilla eliminada' });
            this.loadTemplates(this.lastPage, this.lastSize);
          });
        }
      }
    });
  }
}
