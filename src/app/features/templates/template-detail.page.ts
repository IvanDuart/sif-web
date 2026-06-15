import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate, MealTemplate } from '../../core/api/models/menu-template.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { MealTemplateFormDialog } from './meal-template-form.dialog';
import { InstantiateTemplateDialog } from './instantiate-template.dialog';

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TableModule, TagModule, IfPermissionDirective, EmptyState],
  templateUrl: './template-detail.page.html'
})
export default class TemplateDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private templateService = inject(MenuTemplateService);
  private tenantCtx = inject(TenantContextService);
  private dialogService = inject(DialogService);
  private messageService = inject(MessageService);
  private confirmationService = inject(ConfirmationService);

  template = signal<MenuTemplate | null>(null);
  meals = signal<MealTemplate[]>([]);
  loading = signal(true);
  templateId = '';

  ngOnInit() {
    this.templateId = this.route.snapshot.paramMap.get('id') || '';
    if (this.templateId) {
      this.loadData();
    }
  }

  loadData() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.templateService.getById(tenantId, this.templateId).subscribe({
      next: (t) => {
        this.template.set(t);
        this.meals.set(t.mealTemplates || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  addMeal() {
    const ref = this.dialogService.open(MealTemplateFormDialog, {
      header: 'Añadir Plato',
      width: '450px',
      modal: true,
      data: { templateId: this.templateId },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Plato añadido correctamente' });
          this.loadData();
        }
      });
    }
  }

  editMeal(meal: MealTemplate) {
    const ref = this.dialogService.open(MealTemplateFormDialog, {
      header: 'Editar Plato',
      width: '450px',
      modal: true,
      data: { templateId: this.templateId, meal },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Plato actualizado correctamente' });
          this.loadData();
        }
      });
    }
  }

  deleteMeal(meal: MealTemplate) {
    this.confirmationService.confirm({
      message: '¿Eliminar este plato de la plantilla?',
      header: 'Confirmar',
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: 'Sí',
      rejectLabel: 'Cancelar',
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.templateService.deleteMeal(tenantId, this.templateId, meal.id).subscribe(() => {
            this.messageService.add({ severity: 'success', summary: 'Éxito', detail: 'Plato eliminado' });
            this.loadData();
          });
        }
      }
    });
  }

  instantiateTemplate() {
    const currentTemplate = this.template();
    if (!currentTemplate) return;

    const ref = this.dialogService.open(InstantiateTemplateDialog, {
      header: 'Asignar Plantilla a Paciente',
      width: '450px',
      modal: true,
      data: { template: currentTemplate },
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
}
