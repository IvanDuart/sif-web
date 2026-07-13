import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { MenuService } from '../../../../core/api/services/menu.api';
import { MealService } from '../../../../core/api/services/meal.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { Menu } from '../../../../core/api/models/menu.model';
import { Meal } from '../../../../core/api/models/meal.model';

const DAY_MAP = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

@Component({
  selector: 'app-patient-today-meals',
  standalone: true,
  imports: [CommonModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="data-card border border-surface-200 dark:border-surface-700 flex flex-col h-full">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-utensils text-primary-500 text-xl"></i>
          <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
            {{ t('patient_dashboard.today_meals', { defaultValue: 'Comidas de Hoy' }) }}
          </h3>
        </div>
        <span class="bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 text-xs font-bold px-2 py-0.5 rounded">
          {{ todayLabel() }}
        </span>
      </div>

      @if (loading()) {
        <div class="flex-1 flex items-center justify-center py-6">
          <i class="fa-solid fa-spinner fa-spin text-primary-500 text-xl"></i>
        </div>
      } @else if (todayMeals().length > 0) {
        <div class="space-y-4 flex-1 overflow-y-auto max-h-[300px] pr-1">
          @for (meal of todayMeals(); track meal.id) {
            <div class="p-3 bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-100 dark:border-surface-700/50">
              <span class="text-xs font-bold text-primary-500 uppercase tracking-wider">
                {{ mealTypeLabel(meal.mealType) }}
              </span>
              <p class="text-sm text-surface-800 dark:text-surface-200 mt-1 whitespace-pre-wrap">
                {{ meal.description }}
              </p>
            </div>
          }
        </div>
      } @else {
        <div class="flex-1 flex flex-col items-center justify-center text-center py-8 text-surface-400">
          <i class="fa-solid fa-cookie-bite text-3xl mb-2 text-surface-300"></i>
          <p class="text-sm">
            {{ t('patient_dashboard.no_meals_today', { defaultValue: 'No hay comidas planificadas para hoy' }) }}
          </p>
        </div>
      }
    </div>
  `
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
    // Standardize comparison to matching normalized spanish week day strings without accents if needed
    // The weekdays are LUNES, MARTES, MIERCOLES, JUEVES, VIERNES, SABADO, DOMINGO in uppercase.
    const filtered = meals.filter(m => m.dayOfWeek.toUpperCase() === todayDayOfWeek.toUpperCase());
    
    // Sort meals if a standard ordering is preferred (e.g. COMIDA, CENA)
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
