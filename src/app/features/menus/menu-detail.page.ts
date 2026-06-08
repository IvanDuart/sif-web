import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TableModule } from 'primeng/table';
import { MenuService } from '../../core/api/services/menu.api';
import { MealService } from '../../core/api/services/meal.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { Menu } from '../../core/api/models/menu.model';
import { Meal } from '../../core/api/models/meal.model';
import { IfPermissionDirective } from '../../core/permissions/if-permission.directive';
import { EmptyState } from '../../shared/ui/empty-state';

@Component({
  selector: 'app-menu-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, CardModule, ButtonModule, TagModule, TableModule, IfPermissionDirective, EmptyState],
  templateUrl: './menu-detail.page.html'
})
export default class MenuDetailPage implements OnInit {
  private route = inject(ActivatedRoute);
  private menuService = inject(MenuService);
  private mealService = inject(MealService);
  private tenantCtx = inject(TenantContextService);

  menu = signal<Menu | null>(null);
  meals = signal<Meal[]>([]);
  loading = signal(true);
  menuId = '';

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
        // Sometimes backend returns meals attached, sometimes we need to fetch them.
        if (m.meals && m.meals.length > 0) {
          this.meals.set(m.meals);
          this.loading.set(false);
        } else {
          // Fetch meals explicitely if not embedded
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

  addMeal() {
    alert("Pendiente: Diálogo agregar comida (MealFormDialog)");
  }

  deleteMeal(meal: Meal) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    
    if (confirm("¿Eliminar esta comida?")) {
      this.mealService.delete(tenantId, meal.id).subscribe(() => {
        this.meals.set(this.meals().filter(m => m.id !== meal.id));
      });
    }
  }
}
