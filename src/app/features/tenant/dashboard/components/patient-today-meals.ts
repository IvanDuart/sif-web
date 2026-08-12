import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { MenuService } from '../../../../core/api/services/menu.api';
import { MealService } from '../../../../core/api/services/meal.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Meal } from '../../../../core/api/models/meal.model';

const DAY_MAP = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

@Component({
  selector: 'app-patient-today-meals',
  standalone: true,
  imports: [CommonModule, TranslocoDirective],
  templateUrl: './patient-today-meals.html'
})
export class PatientTodayMeals implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly mealService = inject(MealService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly transloco = inject(TranslocoService);

  loading = signal(false);
  todayMeals = signal<Meal[]>([]);

  ngOnInit() {
    this.loadTodayMeals();
  }

  loadTodayMeals() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.menuService.history(tenantId, userId).subscribe({
      next: (menus) => {
        const activeMenu = (menus || []).find(m => m.isActive || m.active);
        if (!activeMenu) {
          this.loading.set(false);
          return;
        }

        if (activeMenu.meals && activeMenu.meals.length > 0) {
          this.filterMealsForToday(activeMenu.meals);
          this.loading.set(false);
        } else {
          this.mealService.getByMenuId(tenantId, activeMenu.id).subscribe({
            next: (meals) => {
              this.filterMealsForToday(meals || []);
              this.loading.set(false);
            },
            error: () => this.loading.set(false)
          });
        }
      },
      error: () => this.loading.set(false)
    });
  }

  private filterMealsForToday(meals: Meal[]) {
    const todayDayOfWeek = DAY_MAP[new Date().getDay()];
    const filtered = meals.filter(m => m.dayOfWeek.toUpperCase() === todayDayOfWeek.toUpperCase());

    const mealOrder: Record<string, number> = {
      'DESAYUNO': 0,
      'MEDIA_MANANA': 1,
      'ALMUERZO': 2,
      'COMIDA': 2,
      'MERIENDA': 3,
      'CENA': 4
    };

    filtered.sort((a, b) => {
      const orderA = mealOrder[a.mealType.toUpperCase()] ?? 99;
      const orderB = mealOrder[b.mealType.toUpperCase()] ?? 99;
      return orderA - orderB;
    });

    this.todayMeals.set(filtered);
  }

  todayLabel(): string {
    const todayDayOfWeek = DAY_MAP[new Date().getDay()];
    return this.transloco.translate(`diet_detail.days.${todayDayOfWeek.toLowerCase()}`, { defaultValue: todayDayOfWeek });
  }

  mealTypeLabel(mealType: string): string {
    const key = mealType.toLowerCase();
    const translations: Record<string, string> = {
      desayuno: 'Desayuno',
      media_manana: 'Media Mañana',
      almuerzo: 'Almuerzo',
      comida: 'Comida',
      merienda: 'Merienda',
      cena: 'Cena'
    };
    return this.transloco.translate(`diet_detail.meal_types.${key}`, { defaultValue: translations[key] || mealType });
  }
}
