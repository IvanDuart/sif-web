import { TenantPreferences, MenuCreationMode } from './tenant.model';

export interface TenantBrandingDto {
  name: string;
  primaryColor: string;
  defaultLanguage: string;
  logoUrl: string;
  logoPdfUrl?: string;
  address?: string;
  phone?: string;
  aiEnabled?: boolean;
  /**
   * Decide qué editor de comida se pinta. Llega en el endpoint público de
   * branding, plano (no dentro de `preferences`). Ausente = `'MANUAL'`.
   */
  menuCreationMode?: MenuCreationMode;
  preferences?: TenantPreferences;
}
