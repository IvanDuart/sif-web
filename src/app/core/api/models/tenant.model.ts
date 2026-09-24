/**
 * `MANUAL`: la comida es texto libre (el modo de siempre).
 * `BEDCA`: la comida se compone con alimentos del catálogo y su gramaje.
 */
export type MenuCreationMode = 'MANUAL' | 'BEDCA';

/** Franja horaria del desglose de asistencia. `from` inclusivo, `to` exclusivo, en `HH:mm`. */
export interface AppointmentTimeBand {
  label: string;
  from: string;
  to: string;
}

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
  menu_creation_mode?: MenuCreationMode;
  /** Objetivo de asistencia del centro, 0..1 (la UI lo edita en %). */
  attendance_target_rate?: number;
  /** Horas que separan «cancelada a tiempo» de «cancelada tarde». */
  cancellation_notice_threshold_hours?: number;
  /** Franjas horarias del desglose de asistencia (vacío = bandas por defecto). */
  appointment_time_bands?: AppointmentTimeBand[];
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
