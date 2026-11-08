/**
 * Recetario del centro: recetas propias (`TENANT`) y biblioteca pública de
 * plataforma (`PUBLIC`, solo lectura).
 */
export type RecipeScope = 'PUBLIC' | 'TENANT';

/** Filtro del listado: `ALL` incluye públicas y propias del centro. */
export type RecipeScopeFilter = 'ALL' | RecipeScope;

export interface RecipeItemDto {
  id: string;
  foodId: string;
  foodName: string;
  /** Gramos de porción comestible. */
  quantityG: number;
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
  foodId: string;
  /** Debe ser > 0. */
  quantityG: number;
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
  mealId: string;
}
