import { Component, inject, signal, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoService, TranslocoDirective } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';

import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { TemplateFormDialog } from './template-form.dialog';
import { TemplateUploadDialog } from './template-upload.dialog';
import { InstantiateTemplateDialog, InstantiateTemplateDialogInput } from './instantiate-template.dialog';

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent],
  templateUrl: './templates-list.page.html'
})
export default class TemplatesListPage implements OnInit {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  templates = signal<MenuTemplate[]>([]);
  loading = signal(false);
  totalRecords = signal(0);

  private lastPage = 0;
  private lastSize = 25;

  ngOnInit() {
    this.loadTemplates(0, 25);
  }

  onPage(page: number) {
    this.lastPage = page;
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
    this.modal.open<MenuTemplate>(TemplateFormDialog, {
      label: 'Crear Nueva Plantilla',
      size: 'm'
    }).subscribe(result => {
      this.notify.success('Plantilla creada');
      this.router.navigate(['/templates', result.id]);
    });
  }

  uploadTemplate() {
    this.modal.open<MenuTemplate>(TemplateUploadDialog, {
      label: 'Subir Plantilla (Reconocimiento por IA)',
      size: 'l'
    }).subscribe(result => {
      this.router.navigate(['/templates', result.id]);
    });
  }

  viewTemplate(template: MenuTemplate) {
    this.router.navigate(['/templates', template.id]);
  }

  instantiateTemplate(template: MenuTemplate) {
    this.modal.open<boolean, InstantiateTemplateDialogInput>(InstantiateTemplateDialog, {
      label: 'Asignar Plantilla a Paciente',
      size: 'm',
      data: { template }
    }).subscribe(() => {
      this.notify.success('La plantilla fue instanciada y asignada al paciente.');
    });
  }

  deleteTemplate(template: MenuTemplate) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('templates.delete_confirm_msg', { name: template.name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.templateService.delete(tenantId, template.id).subscribe(() => {
          this.notify.success('Plantilla eliminada');
          this.loadTemplates(this.lastPage, this.lastSize);
        });
      }
    });
  }
}
