import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, Location } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { MealFormDialog, MealFormDialogInput } from './meal-form.dialog';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { ShoppingListService } from '../../core/api/services/shopping-list.api';
import { ShoppingListDialog, ShoppingListDialogInput } from './shopping-list.dialog';

const ALL_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;
const MEAL_ORDER: Record<string, number> = { COMIDA: 0, CENA: 1 };

@Component({
  selector: 'app-menu-detail',
  standalone: true,
  imports: [DatePipe, RouterModule, IfPermissionDirective, TranslocoDirective, TranslocoPipe, SkeletonComponent, TuiButton, TuiBadge],
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
  private readonly tenantBrandingService = inject(TenantBrandingService);
  private readonly shoppingListService = inject(ShoppingListService);

  menu = signal<Menu | null>(null);
  meals = signal<Meal[]>([]);
  loading = signal(true);
  menuId = '';

  allDays = ALL_DAYS;
  canManageMeal = computed(() => this.permissionsService.has('MANAGE_MEAL'));
  canViewMenu = computed(() => this.permissionsService.has('VIEW_MENU'));
  downloadingPdf = signal(false);
  printingPdf = signal(false);
  isAiEnabled = signal(false);
  generatingList = signal(false);

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

    this.tenantBrandingService.getBranding(tenantId).subscribe({
      next: (branding) => this.isAiEnabled.set(branding.aiEnabled === true),
      error: () => {}
    });

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
          this.notify.success(this.transloco.translate('notifications.meal_deleted'));
          this.meals.set(this.meals().filter(m => m.id !== meal.id));
        });
      }
    });
  }

  downloadPdf() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.downloadingPdf.set(true);
    this.menuService.getPdf(tenantId, this.menuId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'menu.pdf';
        anchor.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  printPdf() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.printingPdf.set(true);
    this.menuService.getPdf(tenantId, this.menuId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.addEventListener('load', () => {
          iframe.contentWindow?.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            URL.revokeObjectURL(url);
          }, 1000);
        });
        this.printingPdf.set(false);
      },
      error: () => this.printingPdf.set(false)
    });
  }

  generateShoppingList(supermarket: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.generatingList.set(true);
    this.shoppingListService.generateFromMenu(tenantId, this.menuId, { supermarket }).subscribe({
      next: (result) => {
        this.generatingList.set(false);
        this.modal.open<void, ShoppingListDialogInput>(ShoppingListDialog, {
          label: this.transloco.translate('shopping_list.title'),
          size: 'l',
          data: { shoppingList: result },
        }).subscribe();
      },
      error: (err) => {
        this.generatingList.set(false);
        const msg = err.status === 403
          ? this.transloco.translate('shopping_list.ai_not_enabled')
          : this.transloco.translate('shopping_list.generation_error');
        this.notify.error(msg);
      },
    });
  }

  trackByMeal(_index: number, meal: Meal) {
    return meal.id;
  }
}
