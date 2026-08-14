import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';

import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate, MealTemplate } from '../../core/api/models/menu-template.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { MealTemplateFormDialog, MealTemplateFormDialogInput } from './meal-template-form.dialog';
import { InstantiateTemplateDialog, InstantiateTemplateDialogInput } from './instantiate-template.dialog';

const ALL_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [DatePipe, RouterModule, IfPermissionDirective, TranslocoDirective, TranslocoPipe, SkeletonComponent, TuiButton, TuiTable],
  templateUrl: './template-detail.page.html',
  styleUrls: ['./template-detail.page.scss'],
})
export default class TemplateDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);

  template = signal<MenuTemplate | null>(null);
  meals = signal<MealTemplate[]>([]);
  loading = signal(true);
  templateId = '';

  allDays = ALL_DAYS;
  canManageTemplate = computed(() => this.permissionsService.has('MANAGE_TEMPLATE'));

  groupedMeals = computed(() => {
    const mealMap = new Map<string, MealTemplate[]>();
    for (const day of ALL_DAYS) {
      mealMap.set(day, []);
    }
    for (const meal of this.meals()) {
      const list = mealMap.get(meal.dayOfWeek);
      if (list) {
        list.push(meal);
      }
    }
    for (const [, list] of mealMap) {
      list.sort((a, b) => (MEAL_ORDER[a.mealType] ?? 99) - (MEAL_ORDER[b.mealType] ?? 99));
    }
    return mealMap;
  });

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

  dayLabel(day: string): string {
    return this.transloco.translate(`template_detail.days.${day.toLowerCase()}`);
  }

  getMeal(day: string, mealType: string): MealTemplate | undefined {
    return this.groupedMeals().get(day)?.find(m => m.mealType === mealType);
  }

  addMeal(day?: string, mealType?: string) {
    this.modal.open<MealTemplate, MealTemplateFormDialogInput>(MealTemplateFormDialog, {
      label: this.transloco.translate('template_detail.add_meal'),
      size: 'm',
      data: { templateId: this.templateId, prefillDay: day, prefillMealType: mealType }
    }).subscribe(result => {
      if (result) {
        this.notify.success('Plato añadido correctamente');
        this.loadData();
      }
    });
  }

  editMeal(meal: MealTemplate) {
    this.modal.open<MealTemplate, MealTemplateFormDialogInput>(MealTemplateFormDialog, {
      label: this.transloco.translate('common.edit'),
      size: 'm',
      data: { templateId: this.templateId, meal }
    }).subscribe(result => {
      if (result) {
        this.notify.success('Plato actualizado correctamente');
        this.loadData();
      }
    });
  }

  deleteMeal(meal: MealTemplate) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('template_detail.delete_confirm', { description: meal.description }) || '¿Eliminar este plato de la plantilla?',
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe(confirmed => {
      if (confirmed) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.templateService.deleteMeal(tenantId, this.templateId, meal.id).subscribe(() => {
            this.notify.success('Plato eliminado');
            this.loadData();
          });
        }
      }
    });
  }

  instantiateTemplate() {
    const currentTemplate = this.template();
    if (!currentTemplate) return;

    this.modal.open<boolean, InstantiateTemplateDialogInput>(InstantiateTemplateDialog, {
      label: this.transloco.translate('templates.assign'),
      size: 'm',
      data: { template: currentTemplate }
    }).subscribe(result => {
      if (result) {
        this.notify.success('La plantilla fue instanciada y asignada al paciente.');
      }
    });
  }
}
