import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiInput, TuiTextfield } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';
import { SkeletonComponent } from 'boneyard-js/angular';
import { debounceTime, distinctUntilChanged } from 'rxjs';

import { RecipeService } from '../../core/api/services/recipe.api';
import { RecipeDto, RecipeScopeFilter } from '../../core/api/models/recipe.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { NotificationService, ModalService } from '../../core/ui';
import { EmptyState } from '../../shared/ui/empty-state';
import { PaginationFooter } from '../../shared/ui/pagination-footer';
import { RecipeFormDialog, RecipeFormDialogInput } from './recipe-form.dialog';

const PAGE_SIZE = 24;

@Component({
  selector: 'app-recipes-list',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    TranslocoDirective,
    SkeletonComponent,
    EmptyState,
    PaginationFooter,
    TuiButton,
    TuiInput,
    TuiTextfield,
    TuiBadge,
    TuiSegmented,
  ],
  templateUrl: './recipes-list.page.html',
})
export default class RecipesListPage implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissions = inject(PermissionsService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  readonly recipes = signal<RecipeDto[]>([]);
  readonly loading = signal(false);
  readonly importing = signal(false);
  readonly totalRecords = signal(0);
  readonly scopeFilter = signal<RecipeScopeFilter>('ALL');

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly page = signal(0);
  readonly size = PAGE_SIZE;

  readonly canManageRecipes = computed(
    () =>
      this.permissions.has('MANAGE_RECIPES') ||
      this.permissions.has('MANAGE_MENU') ||
      this.tenantCtx.currentMembership()?.userType === 'STAFF'
  );

  readonly filterIndex = computed(() => {
    switch (this.scopeFilter()) {
      case 'TENANT':
        return 1;
      case 'PUBLIC':
        return 2;
      default:
        return 0;
    }
  });

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => {
        this.page.set(0);
        this.loadRecipes();
      });
    this.loadRecipes();
  }

  setFilterIndex(index: number): void {
    const next: RecipeScopeFilter = index === 1 ? 'TENANT' : index === 2 ? 'PUBLIC' : 'ALL';
    if (next === this.scopeFilter()) return;
    this.scopeFilter.set(next);
    this.page.set(0);
    this.loadRecipes();
  }

  loadRecipes(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.loading.set(true);
    this.recipeService
      .list(tenantId, {
        name: this.searchControl.value.trim() || undefined,
        scope: this.scopeFilter(),
        page: this.page(),
        size: this.size,
        sort: ['name,ASC'],
      })
      .subscribe({
        next: (result) => {
          this.recipes.set(result.content ?? []);
          this.totalRecords.set(result.page?.totalElements ?? 0);
          this.loading.set(false);
        },
        error: () => {
          this.recipes.set([]);
          this.totalRecords.set(0);
          this.loading.set(false);
        },
      });
  }

  onPage(direction: number): void {
    this.page.update((value) => Math.max(0, value + direction));
    this.loadRecipes();
  }

  openRecipe(recipe: RecipeDto): void {
    this.router.navigate(['/recipes', recipe.id]);
  }

  createRecipe(): void {
    this.modal
      .open<RecipeDto, RecipeFormDialogInput>(RecipeFormDialog, {
        label: this.transloco.translate('recipes.create_title'),
        size: 'l',
      })
      .subscribe((created) => {
        if (!created) return;
        this.notify.success(this.transloco.translate('recipes.saved'));
        this.page.set(0);
        this.loadRecipes();
      });
  }

  onImportFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['csv', 'json', 'pdf', 'docx', 'doc', 'png', 'jpg', 'jpeg', 'webp'];
    if (!extension || !allowedExtensions.includes(extension)) {
      this.notify.error(this.transloco.translate('recipes.import_invalid'));
      return;
    }

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.importing.set(true);
    this.recipeService.importRecipes(tenantId, file).subscribe({
      next: (imported) => {
        this.importing.set(false);
        this.notify.success(
          this.transloco.translate('recipes.import_success', { count: imported?.length ?? 0 })
        );
        this.page.set(0);
        this.loadRecipes();
      },
      error: () => {
        this.importing.set(false);
        this.notify.error(this.transloco.translate('recipes.import_error'));
      },
    });
  }

  coverOf(recipe: RecipeDto): string | null {
    const cover = recipe.images?.find((image) => image.cover);
    return cover?.url ?? recipe.images?.[0]?.url ?? null;
  }

  allergensText(recipe: RecipeDto): string {
    return (recipe.allergens ?? []).join(' · ');
  }

  stepCount(recipe: RecipeDto): number {
    return recipe.steps?.length ?? 0;
  }
}
