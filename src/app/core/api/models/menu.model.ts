import { Meal } from './meal.model';

/**
 * Respuesta de `GET /menu/{id}/pdf`: URL prefirmada de MinIO en vez de bytes.
 * El mismo endpoint con `?redirect=true` responde `302` hacia esa URL.
 */
export interface MenuPdfDownloadDto {
  url: string;
  /** Caducidad de la URL, ISO 8601. */
  expiresAt: string;
  /** Versión del menú que representa el PDF. */
  version: number;
}

export interface Menu {
  id: string;
  name: string;
  isActive: boolean;
  active?: boolean;
  createdAt?: string;
  meals?: Meal[];
  assignedAt?: string;
  assignedBy?: string;
  description?: string;
}
