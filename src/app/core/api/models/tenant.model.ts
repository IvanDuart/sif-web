export interface TenantPreferences {
  enable_vacation_module: boolean;
  enable_clock_in_module: boolean;
  default_language: string;
  primary_color: string;
  keycloak_sync_mode: string;
  from_email: string;
  standard_vacation_days: number;
}

export interface Tenant {
  id: string;
  name: string;
  cif: string;
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string;
  enabled?: boolean;
  adminTenant?: boolean;
  preferences?: TenantPreferences;
}
