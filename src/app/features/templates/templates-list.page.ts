import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';
import { TranslocoService, TranslocoDirective } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate } from '../../core/api/models/menu-template.model';
import { Menu } from '../../core/api/models/menu.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { TemplateFormDialog } from './template-form.dialog';
import { TemplateUploadDialog } from './template-upload.dialog';
import { InstantiateTemplateDialog, InstantiateTemplateDialogInput } from './instantiate-template.dialog';

@Component({
  selector: 'app-templates-list',
  standalone: true,
  imports: [ReactiveFormsModule, IfPermissionDirective, TranslocoDirective, EmptyState, SkeletonComponent, TuiButton, TuiTable, DatePipe, TuiInput],
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
  searchControl = new FormControl('');

  sortKey = signal<string>('name');
  sortDirection = signal<'ASC' | 'DESC'>('ASC');

  lastPage = 0;
  lastSize = 25;

  ngOnInit() {
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.lastPage = 0;
      this.loadTemplates(this.lastPage, this.lastSize);
    });

    this.loadTemplates(0, 25);
  }

  onPage(page: number) {
    this.lastPage = page;
    this.loadTemplates(this.lastPage, this.lastSize);
  }

  prevPage() {
    if (this.lastPage > 0) {
      this.lastPage--;
      this.loadTemplates(this.lastPage, this.lastSize);
    }
  }

  nextPage() {
    if ((this.lastPage + 1) * this.lastSize < this.totalRecords()) {
      this.lastPage++;
      this.loadTemplates(this.lastPage, this.lastSize);
    }
  }

  onSort(key: string) {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('ASC');
    }
    this.lastPage = 0;
    this.loadTemplates(this.lastPage, this.lastSize);
  }

  loadTemplates(page: number, size: number) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.templateService.search(
      tenantId,
      page,
      size,
      [`${this.sortKey()},${this.sortDirection()}`],
      this.searchControl.value?.trim() || undefined
    ).subscribe({
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
    this.modal.open<Menu, InstantiateTemplateDialogInput>(InstantiateTemplateDialog, {
      label: 'Asignar Plantilla a Paciente',
      size: 'm',
      data: { template }
    }).subscribe(menu => {
      if (!menu?.id) return;
      this.notify.success('La plantilla fue instanciada y asignada al paciente.');
      this.router.navigate(['/menus', menu.id]);
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
