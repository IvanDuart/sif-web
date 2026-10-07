import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiDataList, TuiDropdown } from '@taiga-ui/core';
import { catchError, forkJoin, of } from 'rxjs';

import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { ShoppingListService } from '../../core/api/services/shopping-list.api';
import { UserTenantRoleService } from '../../core/api/services/user-tenant-role.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { BrandingStore } from '../../core/branding/branding.store';
import { NotificationService } from '../../core/ui';

import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { UserTenantProfileFixedMealsDto } from '../../core/api/models/user.model';
import { EmptyState } from '../../shared/ui/empty-state';

/** Semana de lunes a domingo, como la app nativa. */
const DAY_KEYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'] as const;

const JS_DAY_TO_KEY: Record<number, string> = {
  0: 'DOMINGO',
  1: 'LUNES',
  2: 'MARTES',
  3: 'MIERCOLES',
  4: 'JUEVES',
  5: 'VIERNES',
  6: 'SABADO',
};

/** Hora orientativa de cada comida (la API no guarda hora propia). */
const MEAL_HOURS: Record<string, number> = {
  DESAYUNO: 8,
  MEDIA_MANANA: 10,
  ALMUERZO: 11,
  COMIDA: 13,
  MERIENDA: 17,
  CENA: 21,
};

const MEAL_ICONS: Record<string, string> = {
  DESAYUNO: 'fa-solid fa-mug-saucer',
  MEDIA_MANANA: 'fa-solid fa-mug-hot',
  ALMUERZO: 'fa-solid fa-mug-hot',
  COMIDA: 'fa-solid fa-bowl-food',
  MERIENDA: 'fa-solid fa-apple-whole',
  CENA: 'fa-solid fa-moon',
};

const MEAL_LABELS: Record<string, string> = {
  DESAYUNO: 'Desayuno',
  MEDIA_MANANA: 'Media Mañana',
  ALMUERZO: 'Almuerzo',
  COMIDA: 'Comida',
  MERIENDA: 'Merienda',
  CENA: 'Cena',
};


const SUPERMARKETS = [
  { value: 'MERCADONA', label: 'Mercadona' },
  { value: 'CARREFOUR', label: 'Carrefour' },
  { value: 'LIDL', label: 'Lidl' },
  { value: 'ALCAMPO', label: 'Alcampo' },
  { value: 'DIA', label: 'Dia' },
  { value: 'EL_CORTE_INGLES', label: 'El Corte Inglés' },
  { value: 'ALDI', label: 'Aldi' },
  { value: 'EROSKI', label: 'Eroski' },
  { value: 'CONSUM', label: 'Consum' },
  { value: 'HIPERCOR', label: 'Hipercor' },
  { value: 'MASYMAS', label: 'Mas y Mas' },
];

/** Entrada de la agenda del día: una comida del menú o una pauta fija. */
interface MealEntryVm {
  key: string;
  mealType: string;
  hour: number;
  time: string;
  description: string;
  /** `true` si viene de las pautas fijas (se repite todos los días). */
  everyDay: boolean;
  icon: string;
}

@Component({
  selector: 'app-my-diet',
  standalone: true,
  imports: [RouterModule, TranslocoDirective, SkeletonComponent, EmptyState, TuiDropdown, TuiDataList],
  templateUrl: './my-diet.page.html',
  styles: [`
    /* ── Selector de día ─────────────────────────────────────────────── */
    .day-tabs {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
    }
    .day-tabs::-webkit-scrollbar { display: none; }
    .day-tab {
      flex: none;
      min-width: 52px;
      padding: 8px 14px;
      border-radius: var(--r-pill);
      font-size: 13.5px;
      font-weight: 500;
      color: var(--ink-2);
      transition: background-color var(--motion-duration-fast) var(--motion-ease-out),
        color var(--motion-duration-fast) var(--motion-ease-out);
    }
    .day-tab:hover { background: var(--sunken); color: var(--ink); }
    .day-tab[aria-pressed="true"] {
      background: var(--primary-soft);
      color: var(--primary);
      font-weight: 600;
    }
    .day-tab.is-today:not([aria-pressed="true"]) { color: var(--accent); }

    /* ── Fila de comida ──────────────────────────────────────────────── */
    .meal-row[data-next] { background: var(--primary-soft); }

    /* ── Botón flotante "Generar lista" ──────────────────────────────── */
    .shopping-fab {
      position: fixed;
      right: 24px;
      bottom: 24px;
      z-index: 20;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      border-radius: var(--r-pill);
      background: var(--p-primary-100);
      color: var(--p-primary-700);
      font-size: 14px;
      font-weight: 600;
      box-shadow: var(--shadow-float);
      transition: background-color var(--motion-duration-base) var(--motion-ease-out),
        transform var(--motion-duration-fast) var(--motion-ease-out);
    }
    .shopping-fab:hover { background: var(--p-primary-200); }
    .shopping-fab:active { transform: scale(0.97); }
    @media (max-width: 767px) {
      .shopping-fab {
        right: 16px;
        bottom: calc(var(--bottom-nav-h, 60px) + 16px + env(safe-area-inset-bottom, 0px));
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .day-tab,
      .shopping-fab { transition: none; }
      .shopping-fab:active { transform: none; }
    }
  `],
})
export default class MyDietPage implements OnInit {
  private readonly menuService = inject(MenuService);
  private readonly mealService = inject(MealService);
  private readonly userTenantRoleService = inject(UserTenantRoleService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly transloco = inject(TranslocoService);
  private readonly brandingStore = inject(BrandingStore);
  private readonly shoppingListService = inject(ShoppingListService);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  /** El botón de generar lista solo aparece si la clínica tiene la IA activa. */
  readonly isAiEnabled = this.brandingStore.aiEnabled;
  readonly supermarkets = SUPERMARKETS;
  readonly supermarketMenuOpen = signal(false);
  readonly generatingList = signal(false);

  readonly weekDays = DAY_KEYS;
  readonly todayKey = JS_DAY_TO_KEY[new Date().getDay()] ?? 'LUNES';

  loading = signal(true);
  menu = signal<Menu | null>(null);
  meals = signal<Meal[]>([]);
  fixedMeals = signal<UserTenantProfileFixedMealsDto | null>(null);
  selectedDay = signal<string>(this.todayKey);

  readonly hasFixedMeals = computed(() => {
    const fixed = this.fixedMeals();
    return !!fixed && !!(fixed.breakfast || fixed.lunch || fixed.snack);
  });

  /** Hay dieta si existe un menú activo o pautas fijas que mostrar. */
  readonly hasDiet = computed(() => !!this.menu() || this.hasFixedMeals());

  readonly observations = computed(() => this.fixedMeals()?.observations?.trim() || null);

  /**
   * Agenda del día seleccionado: comidas del menú + pautas fijas ("todos los
   * días"), ordenadas por la hora orientativa. Si una pauta fija coincide con
   * una comida del menú, gana la del menú (es la concreta de ese día).
   */
  readonly entries = computed<MealEntryVm[]>(() => {
    const day = this.selectedDay();

    const fromMenu: MealEntryVm[] = this.meals()
      .filter((meal) => meal.dayOfWeek?.toUpperCase() === day)
      .map((meal) => this.toEntry(meal.mealType, meal.description ?? '', false, meal.id));

    const fixed = this.fixedMeals();
    const fromFixed: MealEntryVm[] = fixed
      ? ([
          ['DESAYUNO', fixed.breakfast],
          ['ALMUERZO', fixed.lunch],
          ['MERIENDA', fixed.snack],
        ] as [string, string | null][])
          .filter(([, text]) => !!text?.trim())
          .map(([type, text]) => this.toEntry(type, text!.trim(), true, `fixed-${type}`))
      : [];

    const menuTypes = new Set(fromMenu.map((entry) => entry.mealType));
    return [...fromMenu, ...fromFixed.filter((entry) => !menuTypes.has(entry.mealType))]
      .sort((a, b) => a.hour - b.hour);
  });

  /** Clave de la próxima comida, solo cuando el día seleccionado es hoy. */
  readonly nextEntryKey = computed<string | null>(() => {
    if (this.selectedDay() !== this.todayKey) return null;
    const hour = new Date().getHours();
    const all = this.entries();
    const index = all.findIndex((entry) => entry.hour >= hour);
    return index < 0 ? null : all[index].key;
  });

  ngOnInit() {
    this.load();
  }

  /** Genera la lista del menú activo y salta a la pantalla de la lista. */
  generateShoppingList(supermarket: string) {
    this.supermarketMenuOpen.set(false);
    const tenantId = this.tenantCtx.currentTenantId();
    const active = this.menu();
    if (!tenantId || !active) return;

    this.generatingList.set(true);
    this.shoppingListService.generateFromMenu(tenantId, active.id, { supermarket }).subscribe({
      next: () => {
        this.generatingList.set(false);
        this.router.navigate(['/shopping-lists']);
      },
      error: () => {
        this.generatingList.set(false);
        this.notify.error(this.transloco.translate('shopping_list.generation_error'));
      },
    });
  }

  selectDay(day: string) {
    this.selectedDay.set(day);
  }

  isToday(day: string): boolean {
    return day === this.todayKey;
  }

  dayLabel(day: string): string {
    return this.transloco.translate(`diet_detail.days.${day.toLowerCase()}`, { defaultValue: day });
  }

  dayShort(day: string): string {
    return this.dayLabel(day).slice(0, 3);
  }

  mealLabel(mealType: string): string {
    return this.transloco.translate(`diet_detail.meal_types.${mealType.toLowerCase()}`, {
      defaultValue: MEAL_LABELS[mealType.toUpperCase()] ?? mealType,
    });
  }

  private toEntry(mealType: string, description: string, everyDay: boolean, key: string): MealEntryVm {
    const type = mealType.toUpperCase();
    const hour = MEAL_HOURS[type] ?? 99;
    return {
      key,
      mealType: type,
      hour,
      time: hour === 99 ? '' : `${hour.toString().padStart(2, '0')}:00`,
      description,
      everyDay,
      icon: MEAL_ICONS[type] ?? 'fa-solid fa-utensils',
    };
  }

  private load() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    forkJoin({
      menus: this.menuService
        .history(tenantId, userId)
        .pipe(catchError(() => of([] as Menu[]))),
      fixed: this.userTenantRoleService
        .getPatientFixedMeals(tenantId, userId)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ menus, fixed }) => {
        this.fixedMeals.set(fixed);
        const active = (menus || []).find((m) => m.isActive || m.active) ?? null;
        this.menu.set(active);

        if (!active) {
          this.meals.set([]);
          this.loading.set(false);
          return;
        }

        if (active.meals && active.meals.length > 0) {
          this.meals.set(active.meals);
          this.loading.set(false);
          return;
        }

        this.mealService.getByMenuId(tenantId, active.id).subscribe({
          next: (meals) => {
            this.meals.set(meals || []);
            this.loading.set(false);
          },
          error: () => {
            this.meals.set([]);
            this.loading.set(false);
          },
        });
      },
      error: () => this.loading.set(false),
    });
  }
}
