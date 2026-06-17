import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { MenuTemplateService } from '../../core/api/services/menu-template.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MenuTemplate, MealTemplate } from '../../core/api/models/menu-template.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { DialogService } from 'primeng/dynamicdialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { MealTemplateFormDialog } from './meal-template-form.dialog';
import { InstantiateTemplateDialog } from './instantiate-template.dialog';

const ALL_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

@Component({
  selector: 'app-template-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, IfPermissionDirective, TranslocoDirective, ConfirmDialogModule, ToastModule],
  templateUrl: './template-detail.page.html',
  styles: [`
    .weekly-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
    }

    .day-column {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      min-width: 0;
    }

    .day-header {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-surface-400);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--p-surface-200);
    }

    .day-body {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .meal-card {
      border-radius: 0.5rem;
      border: 1px solid var(--p-surface-200);
      background: var(--p-surface-0);
      overflow: hidden;
      transition: box-shadow 0.15s ease;
    }

    .meal-card:hover {
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    .meal-card--lunch .meal-card__header {
      background: #f0fdf4;
      border-bottom: 1px solid #dcfce7;
    }

    :host-context(.dark) .meal-card--lunch .meal-card__header {
      background: rgba(34, 197, 94, 0.1);
      border-bottom-color: rgba(34, 197, 94, 0.2);
    }

    .meal-card--dinner .meal-card__header {
      background: #eff6ff;
      border-bottom: 1px solid #dbeafe;
    }

    :host-context(.dark) .meal-card--dinner .meal-card__header {
      background: rgba(59, 130, 246, 0.1);
      border-bottom-color: rgba(59, 130, 246, 0.2);
    }

    .meal-card__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.375rem 0.5rem;
    }

    .meal-card__type {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.6875rem;
      font-weight: 600;
      color: var(--p-surface-600);
    }

    .meal-card__actions {
      display: flex;
      gap: 0.125rem;
    }

    .meal-action-btn {
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 0.25rem;
      background: transparent;
      color: var(--p-surface-400);
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .meal-action-btn:hover {
      background: var(--p-surface-100);
      color: var(--p-surface-700);
    }

    .meal-action-btn--danger:hover {
      background: #fef2f2;
      color: #dc2626;
    }

    :host-context(.dark) .meal-action-btn--danger:hover {
      background: rgba(220, 38, 38, 0.1);
      color: #fca5a5;
    }

    .meal-card__description {
      padding: 0.5rem;
      margin: 0;
      font-size: 0.8125rem;
      line-height: 1.4;
      color: var(--p-surface-700);
    }

    .empty-day-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding: 1rem 0.5rem;
      border: 1px dashed var(--p-surface-300);
      border-radius: 0.5rem;
      background: var(--p-surface-50);
      text-align: center;
      min-height: 5rem;
    }

    .empty-day-card__icon {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 9999px;
      background: var(--p-surface-200);
      color: var(--p-surface-400);
      font-size: 0.75rem;
    }

    .empty-day-card__text {
      margin: 0;
      font-size: 0.6875rem;
      color: var(--p-surface-400);
      line-height: 1.3;
    }

    .empty-day-card__btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.25rem 0.625rem;
      font-size: 0.6875rem;
      font-weight: 600;
      border: 1px solid var(--p-surface-300);
      border-radius: 0.375rem;
      background: var(--p-surface-0);
      color: var(--p-surface-600);
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .empty-day-card__btn:hover {
      background: var(--p-primary-50);
      border-color: var(--p-primary-300);
      color: var(--p-primary-700);
    }

    @media (max-width: 1280px) {
      .weekly-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }

    @media (max-width: 1024px) {
      .weekly-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 640px) {
      .weekly-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export default class TemplateDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly templateService = inject(MenuTemplateService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly dialogService = inject(DialogService);
  private readonly messageService = inject(MessageService);
  private readonly confirmationService = inject(ConfirmationService);
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

  mealTypeLabel(mealType: string): string {
    const key = mealType === 'COMIDA' ? 'lunch' : 'dinner';
    return this.transloco.translate(`template_detail.meal_types.${key}`);
  }

  addMeal(day?: string) {
    const ref = this.dialogService.open(MealTemplateFormDialog, {
      header: this.transloco.translate('template_detail.add_meal'),
      width: '450px',
      modal: true,
      data: { templateId: this.templateId, prefillDay: day },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Plato añadido correctamente' });
          this.loadData();
        }
      });
    }
  }

  editMeal(meal: MealTemplate) {
    const ref = this.dialogService.open(MealTemplateFormDialog, {
      header: this.transloco.translate('common.edit'),
      width: '450px',
      modal: true,
      data: { templateId: this.templateId, meal },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Plato actualizado correctamente' });
          this.loadData();
        }
      });
    }
  }

  deleteMeal(meal: MealTemplate) {
    this.confirmationService.confirm({
      message: this.transloco.translate('template_detail.delete_confirm', { description: meal.description }) || '¿Eliminar este plato de la plantilla?',
      header: this.transloco.translate('common.attention'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (tenantId) {
          this.templateService.deleteMeal(tenantId, this.templateId, meal.id).subscribe(() => {
            this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Plato eliminado' });
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
      header: this.transloco.translate('templates.assign'),
      width: '450px',
      modal: true,
      data: { template: currentTemplate },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });

    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) {
          this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'La plantilla fue instanciada y asignada al paciente.' });
        }
      });
    }
  }
}
