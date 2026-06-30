import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogService } from 'primeng/dynamicdialog';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { ToastModule } from 'primeng/toast';
import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { MealFormDialog } from './meal-form.dialog';

const ALL_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

@Component({
  selector: 'app-menu-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, IfPermissionDirective, TranslocoDirective, ConfirmDialogModule, ToastModule],
  providers: [DialogService, ConfirmationService, MessageService],
  templateUrl: './menu-detail.page.html',
  styleUrls: ['./menu-detail.page.scss'],
})
export default class MenuDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly menuService = inject(MenuService);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly dialogService = inject(DialogService);
  private readonly transloco = inject(TranslocoService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);
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
    const ref = this.dialogService.open(MealFormDialog, {
      header: this.transloco.translate('diet_detail.add_meal'),
      width: '500px',
      modal: true,
      data: { menuId: this.menuId, prefillDay: day },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) this.loadData();
      });
    }
  }

  editMeal(meal: Meal) {
    const ref = this.dialogService.open(MealFormDialog, {
      header: this.transloco.translate('common.edit'),
      width: '500px',
      modal: true,
      data: { meal },
      breakpoints: { '960px': '75vw', '640px': '90vw' }
    });
    if (ref) {
      ref.onClose.subscribe((result) => {
        if (result) this.loadData();
      });
    }
  }

  deleteMeal(meal: Meal) {
    this.confirmationService.confirm({
      message: this.transloco.translate('diet_detail.delete_confirm', { description: meal.description }) || '¿Eliminar este plato?',
      header: this.transloco.translate('common.attention'),
      icon: 'fa-solid fa-triangle-exclamation',
      acceptLabel: this.transloco.translate('common.yes'),
      rejectLabel: this.transloco.translate('common.cancel'),
      acceptButtonStyleClass: 'p-button-danger',
      accept: () => {
        const tenantId = this.tenantCtx.currentTenantId();
        if (!tenantId) return;
        this.mealService.delete(tenantId, meal.id).subscribe(() => {
          this.messageService.add({ severity: 'success', summary: this.transloco.translate('common.success'), detail: 'Plato eliminado' });
          this.meals.set(this.meals().filter(m => m.id !== meal.id));
        });
      }
    });
  }

  trackByMeal(_index: number, meal: Meal) {
    return meal.id;
  }
}
