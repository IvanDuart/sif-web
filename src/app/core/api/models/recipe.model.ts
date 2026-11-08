/**
 * Recetario del centro: recetas propias (`TENANT`) y biblioteca pública de
 * plataforma (`PUBLIC`, solo lectura).
 */
export type RecipeScope = 'PUBLIC' | 'TENANT';

/** Filtro del listado: `ALL` incluye públicas y propias del centro. */
export type RecipeScopeFilter = 'ALL' | RecipeScope;

export interface RecipeItemDto {
  id: string;
  foodId: string | null;
  foodName: string;
  /** Gramos de porción comestible; puede faltar si solo hay medida casera. */
  quantityG: number | null;
  /** Cantidad natural o medida casera ("2 unidades", "1 cucharada", "al gusto"). */
  householdMeasure?: string | null;
  sortOrder?: number | null;
}

export interface RecipeStepDto {
  id: string;
  stepNumber: number;
  instruction: string;
}

export interface RecipeHouseholdMeasureDto {
  id: string;
  label: string;
  grams: number;
}

/** Imagen de receta alojada en MinIO; `url` ya viene prefirmada. */
export interface RecipeImageDto {
  id: string;
  storedFileId: string;
  url: string;
  /** Caducidad de la URL prefirmada, ISO 8601. */
  expiresAt: string;
  sortOrder?: number | null;
  cover: boolean;
}

export interface RecipeDto {
  id: string;
  tenantId: string;
  scope: RecipeScope;
  name: string;
  description: string | null;
  servings: number | null;
  allergens: string[];
  items: RecipeItemDto[];
  steps: RecipeStepDto[];
  householdMeasures: RecipeHouseholdMeasureDto[];
  images: RecipeImageDto[];
  createdAt: string;
  updatedAt: string | null;
}

export interface RecipeItemRequest {
  /** Alimento BEDCA; nulo para ingredientes libres. */
  foodId?: string | null;
  /** Nombre visible del ingrediente (obligatorio si no hay `foodId`). */
  foodName?: string | null;
  /** Gramos; nulo si el ingrediente solo se expresa en medida casera. */
  quantityG?: number | null;
  /** Cantidad natural o medida casera ("2 unidades", "1 cucharada", "al gusto"). */
  householdMeasure?: string | null;
  sortOrder?: number | null;
}

export interface RecipeStepRequest {
  stepNumber?: number | null;
  instruction: string;
}

export interface RecipeHouseholdMeasureRequest {
  label: string;
  /** Debe ser > 0. */
  grams: number;
}

/** Alta y edición de una receta propia del centro. */
export interface RecipeRequest {
  name: string;
  description?: string | null;
  servings?: number | null;
  allergens?: string[];
  items?: RecipeItemRequest[];
  steps?: RecipeStepRequest[];
  householdMeasures?: RecipeHouseholdMeasureRequest[];
}

export interface RecipeListQuery {
  name?: string;
  scope?: RecipeScopeFilter;
  page?: number;
  size?: number;
  sort?: string[];
}

/** Payload de `POST /recipes/{id}/instantiate`. */
export interface InstantiateRecipeRequest {
  /** Comida de un menú de paciente. */
  mealId?: string | null;
  /** Comida de una plantilla del centro. */
  mealTemplateId?: string | null;
  /** Personas/raciones con las que escalar; si falta se usa el de la receta. */
  servings?: number | null;
}
