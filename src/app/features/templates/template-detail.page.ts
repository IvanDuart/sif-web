import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { EMPTY, Observable } from 'rxjs';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
import { Menu } from '../../core/api/models/menu.model';
import { ALL_DAYS, MEAL_ORDER, MEAL_TYPES } from '../menus/menu.constants';
import { MealCell } from '../menus/components/meal-cell';
import { MealItemsEditor } from '../menus/components/meal-items-editor';
import { MealItemRequest } from '../../core/api/services/meal.api';
import { BrandingStore } from '../../core/branding/branding.store';

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [DatePipe, RouterModule, FormsModule, IfPermissionDirective, TranslocoDirective, TranslocoPipe, SkeletonComponent, MealCell, MealItemsEditor, TuiButton, TuiTable],
  templateUrl: './template-detail.page.html',
  styleUrls: ['./template-detail.page.scss'],
})
export default class TemplateDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly brandingStore = inject(BrandingStore);

  template = signal<MenuTemplate | null>(null);
  meals = signal<MealTemplate[]>([]);
  loading = signal(true);
  templateId = '';

  editingMealId = signal<string | null>(null);
  editingDescription = signal<string>('');
  savingInline = signal<boolean>(false);

  allDays = ALL_DAYS;
  mealTypes = MEAL_TYPES;
  /** Comida cuyo editor de ingredientes está desplegado. Sólo una a la vez. */
  expandedMealId = signal<string | null>(null);
  isBedcaMode = this.brandingStore.isBedcaMode;
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

  isEditing(day: string, mealType: string): boolean {
    const meal = this.getMeal(day, mealType);
    return !!meal && this.editingMealId() === meal.id;
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

  startEditMeal(meal: MealTemplate) {
    this.editingMealId.set(meal.id);
    this.editingDescription.set(meal.description ?? '');
  }

  cancelInlineEdit() {
    this.editingMealId.set(null);
    this.editingDescription.set('');
  }

  saveInlineEdit(meal: MealTemplate) {
    const desc = this.editingDescription().trim();
    if (!desc) return;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.savingInline.set(true);
    this.templateService.updateMeal(tenantId, this.templateId, meal.id, {
      dayOfWeek: meal.dayOfWeek,
      mealType: meal.mealType,
      description: desc,
    }).subscribe({
      next: (updatedMeal) => {
        this.savingInline.set(false);
        this.editingMealId.set(null);
        this.editingDescription.set('');
        this.notify.success(this.transloco.translate('notifications.meal_updated'));
        const newDesc = updatedMeal?.description ?? desc;
        this.meals.update(list => list.map(m => m.id === meal.id ? { ...m, description: newDesc } : m));
      },
      error: () => {
        this.savingInline.set(false);
        this.notify.error(this.transloco.translate('common.error'));
      }
    });
  }

  editMeal(meal: MealTemplate) {
    this.startEditMeal(meal);
  }

  /**
   * En modo BEDCA editar despliega el editor de ingredientes; en MANUAL sigue
   * siendo el textarea en línea.
   */
  onEditMeal(meal: MealTemplate): void {
    if (this.isBedcaMode()) {
      // Un solo editor abierto a la vez, sea el de texto o el de ingredientes.
      this.cancelInlineEdit();
      this.expandedMealId.update(current => (current === meal.id ? null : meal.id));
      return;
    }
    this.expandedMealId.set(null);
    this.startEditMeal(meal);
  }

  isExpanded(day: string, mealType: string): boolean {
    const meal = this.getMeal(day, mealType);
    return !!meal && this.expandedMealId() === meal.id;
  }

  /**
   * Persiste los ingredientes de una comida de plantilla. El endpoint exige
   * `dayOfWeek` y `mealType`, así que se reenvían los de la propia comida.
   */
  readonly saveMealItems = (
    mealId: string,
    items: MealItemRequest[],
    fallbackDescription: string | null
  ): Observable<unknown> => {
    const tenantId = this.tenantCtx.currentTenantId();
    const meal = this.meals().find(m => m.id === mealId);
    if (!tenantId || !meal) return EMPTY;
    return this.templateService.updateMeal(tenantId, this.templateId, mealId, {
      dayOfWeek: meal.dayOfWeek,
      mealType: meal.mealType,
      items,
      // Igual que en los menús: sólo se manda al vaciar la lista, para no
      // dejar la comida sin texto.
      ...(fallbackDescription !== null ? { description: fallbackDescription } : {}),
    });
  };

  /**
   * Las plantillas no tienen endpoint de nutrición, así que sólo se recargan las
   * comidas: los macros de esta pantalla se calculan en local.
   */
  onItemsSaved(): void {
    this.loadData();
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
          // Colapsar antes de borrar: al destruirse, el editor vuelca su
          // guardado pendiente, y hacerlo contra una comida ya borrada daría 404.
          if (this.expandedMealId() === meal.id) this.expandedMealId.set(null);
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

    this.modal.open<Menu, InstantiateTemplateDialogInput>(InstantiateTemplateDialog, {
      label: this.transloco.translate('templates.assign'),
      size: 'm',
      data: { template: currentTemplate }
    }).subscribe(menu => {
      if (!menu?.id) return;
      this.notify.success('La plantilla fue instanciada y asignada al paciente.');
      this.router.navigate(['/menus', menu.id]);
    });
  }
}
