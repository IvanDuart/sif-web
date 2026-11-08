import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { SkeletonComponent } from 'boneyard-js/angular';

import { RecipeService } from '../../core/api/services/recipe.api';
import { RecipeDto } from '../../core/api/models/recipe.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { ConfirmService, ModalService, NotificationService } from '../../core/ui';
import { RecipeFormDialog, RecipeFormDialogInput } from './recipe-form.dialog';
import { RecipeInstantiateDialog, RecipeInstantiateDialogInput } from './recipe-instantiate.dialog';

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RouterModule, DatePipe, TranslocoDirective, SkeletonComponent, TuiButton, TuiBadge],
  templateUrl: './recipe-detail.page.html',
})
export default class RecipeDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissions = inject(PermissionsService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly recipe = signal<RecipeDto | null>(null);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly cloning = signal(false);
  readonly recipeId = signal('');
  /** Raciones de la receta tal y como vienen del servidor (base del escalado). */
  readonly recipeServings = signal(1);
  /** Raciones elegidas por el paciente/nutricionista con el selector - / +. */
  readonly selectedServings = signal(1);
  /** `?servings=X` de la URL: raciones pautadas al abrir desde una comida. */
  private requestedServings: number | null = null;

  readonly isPublic = computed(() => this.recipe()?.scope === 'PUBLIC');
  readonly canManage = computed(
    () =>
      this.permissions.has('MANAGE_RECIPES') ||
      this.permissions.has('MANAGE_MENU') ||
      this.tenantCtx.currentMembership()?.userType === 'STAFF'
  );
  readonly canEdit = computed(() => this.canManage() && !this.isPublic());

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.recipeId.set(id);
    const servingsParam = Number(this.route.snapshot.queryParamMap.get('servings'));
    this.requestedServings = Number.isFinite(servingsParam) && servingsParam > 0 ? servingsParam : null;
    this.load();
  }

  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.recipeId()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.recipeService.getById(tenantId, this.recipeId()).subscribe({
      next: (recipe) => {
        const base = recipe.servings && recipe.servings > 0 ? recipe.servings : 1;
        this.recipeServings.set(base);
        this.selectedServings.set(this.requestedServings ?? base);
        // Consumido: los refrescos posteriores respetan lo que elija el usuario.
        this.requestedServings = null;
        this.recipe.set(recipe);
        this.loading.set(false);
      },
      error: () => {
        this.recipe.set(null);
        this.loading.set(false);
      },
    });
  }

  coverUrl(recipe: RecipeDto): string | null {
    const cover = recipe.images?.find((image) => image.cover);
    return cover?.url ?? recipe.images?.[0]?.url ?? null;
  }

  /** Factor de escalado por personas. */
  readonly scaleFactor = computed(() => this.selectedServings() / (this.recipeServings() || 1));

  incrementServings(): void {
    this.selectedServings.update((value) => Math.min(99, value + 1));
  }

  decrementServings(): void {
    this.selectedServings.update((value) => Math.max(1, value - 1));
  }

  /** Gramos escalados por el número de personas. */
  scaledQuantityG(quantityG: number | null | undefined): number | null {
    if (quantityG === null || quantityG === undefined) return null;
    return Math.round(quantityG * this.scaleFactor());
  }

  /**
   * Medida casera escalada. Sólo se multiplica si empieza por un número
   * ("2 unidades" → "4 unidades"); textos como "al gusto" se quedan igual.
   */
  scaledHouseholdMeasure(measure: string | null | undefined): string | null {
    if (!measure) return null;
    const match = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(measure.trim());
    if (!match) return measure;
    const amount = Number(match[1].replace(',', '.')) * this.scaleFactor();
    const rounded = Math.round(amount * 10) / 10;
    const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${text}${match[2]}`;
  }

  sortedSteps(recipe: RecipeDto) {
    return [...(recipe.steps ?? [])].sort((a, b) => a.stepNumber - b.stepNumber);
  }

  sortedItems(recipe: RecipeDto) {
    return [...(recipe.items ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }

  edit(): void {
    const recipe = this.recipe();
    if (!recipe) return;
    this.modal
      .open<RecipeDto, RecipeFormDialogInput>(RecipeFormDialog, {
        label: this.transloco.translate('recipes.edit_title'),
        size: 'l',
        data: { recipe },
      })
      .subscribe((updated) => {
        if (!updated) return;
        this.notify.success(this.transloco.translate('recipes.saved'));
        this.recipe.set(updated);
      });
  }

  cloneRecipe(): void {
    const recipe = this.recipe();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!recipe || !tenantId) return;

    this.cloning.set(true);
    this.recipeService.clone(tenantId, recipe.id).subscribe({
      next: (cloned) => {
        this.cloning.set(false);
        this.notify.success(this.transloco.translate('recipes.cloned'));
        this.router.navigate(['/recipes', cloned.id]);
      },
      error: () => {
        this.cloning.set(false);
        this.notify.error(this.transloco.translate('recipes.clone_error'));
      },
    });
  }

  deleteRecipe(): void {
    const recipe = this.recipe();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!recipe || !tenantId || this.isPublic()) return;

    this.confirm
      .confirm({
        label: this.transloco.translate('common.attention'),
        content: this.transloco.translate('recipes.delete_confirm', { name: recipe.name }),
        yes: this.transloco.translate('common.yes'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.recipeService.delete(tenantId, recipe.id).subscribe({
          next: () => {
            this.notify.success(this.transloco.translate('recipes.deleted'));
            this.router.navigate(['/recipes']);
          },
          error: () => this.notify.error(this.transloco.translate('recipes.delete_error')),
        });
      });
  }

  uploadImage(event: Event, cover: boolean): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const recipe = this.recipe();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!file || !recipe || !tenantId) return;

    this.uploading.set(true);
    this.recipeService.uploadImage(tenantId, recipe.id, file, cover).subscribe({
      next: (updated) => {
        this.uploading.set(false);
        this.recipe.set(updated);
        this.notify.success(this.transloco.translate('recipes.image_uploaded'));
      },
      error: () => {
        this.uploading.set(false);
        this.notify.error(this.transloco.translate('recipes.image_error'));
      },
    });
  }

  instantiate(): void {
    const recipe = this.recipe();
    if (!recipe) return;
    this.modal
      .open<boolean, RecipeInstantiateDialogInput>(RecipeInstantiateDialog, {
        label: this.transloco.translate('recipes.instantiate_title'),
        size: 'm',
        data: { recipe },
      })
      .subscribe((done) => {
        if (done) this.notify.success(this.transloco.translate('recipes.instantiate_success'));
      });
  }

  back(): void {
    this.router.navigate(['/recipes']);
  }
}
