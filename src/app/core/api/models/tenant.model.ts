export interface TenantPreferences {
  enable_vacation_module: boolean;
  enable_clock_in_module: boolean;
  ai_enabled?: boolean;
  gemini_api_key?: string;
  default_language: string;
  primary_color: string;
  keycloak_sync_mode: string;
  from_email: string;
  standard_vacation_days: number;
  active_anamnesis_fields?: string[];
  show_price?: boolean;
  enable_appointment_reminders?: boolean;
}

export interface Tenant {
  id: string;
  name: string;
  cif: string;
  address?: string;
  phone?: string;
  countryCode?: string;
  stateCode?: string;
  city?: string;
  createdAt?: string;
  updatedAt?: string;
  disabledAt?: string;
  enabled?: boolean;
  adminTenant?: boolean;
  preferences?: TenantPreferences;
}
