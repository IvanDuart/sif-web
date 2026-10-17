import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiDialogContext, TuiButton } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate, MealTemplate } from '../../core/api/models/menu-template.model';
import { ALL_DAYS, MEAL_ORDER, MEAL_TYPES } from '../menus/menu.constants';
import { MealCell } from '../menus/components/meal-cell';

export interface TemplatePreviewDialogInput {
  templateId: string;
  /** Nombre ya conocido por quien abre el diálogo: evita el hueco del título mientras carga. */
  templateName?: string;
}

/**
 * Previsualización de sólo lectura de una plantilla de menú: la misma rejilla
 * semanal del detalle, pero dentro de un diálogo y sin ninguna acción de
 * edición.
 *
 * Existe para que asignar una plantilla a un paciente no sea a ciegas: desde
 * el diálogo de asignación se puede ver qué comidas trae antes de confirmar.
 * El listado de plantillas sólo devuelve la cabecera, así que aquí se pide el
 * detalle completo (`getById`) para tener las comidas.
 */
@Component({
  selector: 'app-template-preview',
  standalone: true,
  imports: [TranslocoDirective, TuiButton, TuiTable, MealCell],
  templateUrl: './template-preview.dialog.html',
  styleUrl: './template-preview.dialog.scss',
})
export class TemplatePreviewDialog implements OnInit {
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);

  readonly context = injectContext<TuiDialogContext<void, TemplatePreviewDialogInput>>();

  template = signal<MenuTemplate | null>(null);
  meals = signal<MealTemplate[]>([]);
  loading = signal(true);
  failed = signal(false);

  allDays = ALL_DAYS;
  mealTypes = MEAL_TYPES;

  /** El nombre que pasa el llamante hasta que llega el detalle del servidor. */
  title = computed(() => this.template()?.name ?? this.context.data?.templateName ?? '');
  hasMeals = computed(() => this.meals().length > 0);

  private groupedMeals = computed(() => {
    const mealMap = new Map<string, MealTemplate[]>();
    for (const day of ALL_DAYS) {
      mealMap.set(day, []);
    }
    for (const meal of this.meals()) {
      mealMap.get(meal.dayOfWeek)?.push(meal);
    }
    for (const [, list] of mealMap) {
      list.sort((a, b) => (MEAL_ORDER[a.mealType] ?? 99) - (MEAL_ORDER[b.mealType] ?? 99));
    }
    return mealMap;
  });

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    const templateId = this.context.data?.templateId;
    if (!tenantId || !templateId) {
      this.loading.set(false);
      this.failed.set(true);
      return;
    }

    this.templateService.getById(tenantId, templateId).subscribe({
      next: (t) => {
        this.template.set(t);
        this.meals.set(t.mealTemplates || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  dayLabel(day: string): string {
    return this.transloco.translate(`template_detail.days.${day.toLowerCase()}`);
  }

  getMeal(day: string, mealType: string): MealTemplate | undefined {
    return this.groupedMeals().get(day)?.find(m => m.mealType === mealType);
  }

  close() {
    this.context.$implicit.complete();
  }
}
