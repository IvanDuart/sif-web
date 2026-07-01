import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { MealFormDialog, MealFormDialogInput } from './meal-form.dialog';

const ALL_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

@Component({
  selector: 'app-menu-detail',
  standalone: true,
  imports: [DatePipe, RouterModule, IfPermissionDirective, TranslocoDirective],
  templateUrl: './menu-detail.page.html',
  styleUrls: ['./menu-detail.page.scss'],
})
export default class MenuDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly menuService = inject(MenuService);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly modal = inject(ModalService);
  private readonly transloco = inject(TranslocoService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly permissionsService = inject(PermissionsService);
  private readonly location = inject(Location);

  menu = signal<Menu | null>(null);
  meals = signal<Meal[]>([]);
  loading = signal(true);
  menuId = '';

  allDays = ALL_DAYS;
  canManageMeal = computed(() => this.permissionsService.has('MANAGE_MEAL'));

  groupedMeals = computed(() => {
    const mealMap = new Map<string, Meal[]>();
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

  goBack() {
    this.location.back();
  }

  ngOnInit() {
    this.menuId = this.route.snapshot.paramMap.get('id') || '';
    if (this.menuId) {
      this.loadData();
    }
  }

  loadData() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.menuService.getById(tenantId, this.menuId).subscribe({
      next: (m) => {
        this.menu.set(m);
        if (m.meals && m.meals.length > 0) {
          this.meals.set(m.meals);
          this.loading.set(false);
        } else {
          this.mealService.getByMenuId(tenantId, this.menuId).subscribe({
            next: (mealsList) => {
              this.meals.set(mealsList || []);
              this.loading.set(false);
            },
            error: () => this.loading.set(false)
          });
        }
      },
      error: () => this.loading.set(false)
    });
  }

  dayLabel(day: string): string {
    return this.transloco.translate(`diet_detail.days.${day.toLowerCase()}`);
  }

  mealTypeLabel(mealType: string): string {
    const key = mealType === 'COMIDA' ? 'lunch' : 'dinner';
    return this.transloco.translate(`diet_detail.meal_types.${key}`);
  }

  addMeal(day?: string) {
    this.modal.open<Meal, MealFormDialogInput>(MealFormDialog, {
      label: this.transloco.translate('diet_detail.add_meal'),
      size: 'm',
      data: { menuId: this.menuId, prefillDay: day }
    }).subscribe(result => {
      if (result) this.loadData();
    });
  }

  editMeal(meal: Meal) {
    this.modal.open<Meal, MealFormDialogInput>(MealFormDialog, {
      label: this.transloco.translate('common.edit'),
      size: 'm',
      data: { meal }
    }).subscribe(result => {
      if (result) this.loadData();
    });
  }

  deleteMeal(meal: Meal) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('diet_detail.delete_confirm', { description: meal.description }) || '¿Eliminar este plato?',
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.cancel'),
    }).subscribe(confirmed => {
      if (confirmed) {
        const tenantId = this.tenantCtx.currentTenantId();
        if (!tenantId) return;
        this.mealService.delete(tenantId, meal.id).subscribe(() => {
          this.notify.success('Plato eliminado');
          this.meals.set(this.meals().filter(m => m.id !== meal.id));
        });
      }
    });
  }

  trackByMeal(_index: number, meal: Meal) {
    return meal.id;
  }
}
