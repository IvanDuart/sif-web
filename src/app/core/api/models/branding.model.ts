import { TenantPreferences } from './tenant.model';

export interface TenantBrandingDto {
  name: string;
  primaryColor: string;
  defaultLanguage: string;
  logoUrl: string;
  logoPdfUrl?: string;
  address?: string;
  phone?: string;
  aiEnabled?: boolean;
  preferences?: TenantPreferences;
}
