import { BodyCompositionReport, BodyMeasurementDto } from './body-measurement.model';

export type UserType = 'STAFF' | 'PATIENT';
export type Gender = 'MALE' | 'FEMALE';

/** Estado clínico del paciente en un centro, independiente de `enabled` (P1). */
export type ClinicalStatus = 'ONBOARDING' | 'ACTIVE' | 'PAUSED' | 'DISCHARGED' | 'DROPPED_OUT';

/** Estados en los que el backend rechaza cualquier escritura bajo el tenant. */
export const CLINICAL_STATUS_READ_ONLY: readonly ClinicalStatus[] = [
  'PAUSED',
  'DISCHARGED',
  'DROPPED_OUT',
];

export interface ClinicalStatusChangeRequest {
  clinicalStatus: ClinicalStatus;
  reason?: string | null;
}

export interface ClinicalStatusChangeDto {
  userId: string;
  clinicalStatus: ClinicalStatus;
  reason: string | null;
  changedAt: string;
}

export interface ClinicalStatusHistoryEntryDto {
  id: string;
  previousStatus: ClinicalStatus | null;
  newStatus: ClinicalStatus;
  reason: string | null;
  changedAt: string;
  changedBy: string | null;
}

export interface TenantMembershipDto {
  tenantId: string;
  tenantName: string;
  roleCode: string;
  permissions: string[];
  userType?: UserType;
  /** Estado clínico del paciente en ese centro (solo para `PATIENT`). */
  clinicalStatus?: ClinicalStatus | null;
}

/** `roleCode` sintético del superadministrador: el backend no lo emite. */
export const SUPERADMIN_ROLE_CODE = 'SUPERADMIN';

/**
 * Un superadministrador entra en cualquier centro sin ser miembro de ninguno,
 * así que `memberships` le llega vacío. Para que el resto de la aplicación
 * siga leyendo el centro activo de un único sitio (`AuthService.selectedTenant`),
 * le fabricamos la membresía al elegir centro.
 *
 * - `userType: 'STAFF'` porque usa las herramientas del profesional, no las del
 *   paciente; sin esto el menú lateral le ofrecería «Mi dieta» y «Evolución».
 * - `permissions: []` a propósito: los suyos no se derivan de aquí, los concede
 *   `TenantContextService.hasPermission()` por el flag `superAdmin`.
 */
export function superAdminMembership(tenantId: string, tenantName: string): TenantMembershipDto {
  return {
    tenantId,
    tenantName,
    roleCode: SUPERADMIN_ROLE_CODE,
    permissions: [],
    userType: 'STAFF',
  };
}

export interface UserTenantProfileDto {
  consultationReason: string | null;
  diseases: string | null;
  medicalHistory: string | null;
  habits: string | null;
  lifestyle: string | null;
  exercise: string | null;
  psyche: string | null;
  allergiesIntolerances: string | null;
  foodPreferences: string | null;
  medicationSupplements: string | null;
  gastrointestinalStatus: string | null;
  hormonalCycle: string | null;
  breakfast: string | null;
  lunch: string | null;
  snack: string | null;
  observations: string | null;
  boneMassKg?: number | null;
  bodyCompositionReport?: BodyCompositionReport | null;

  // Checklist fields
  hasDiabetes: boolean;
  diabetesNotes: string | null;
  hasHypertension: boolean;
  hypertensionNotes: string | null;
  hasHeartDisease: boolean;
  heartDiseaseNotes: string | null;
  hasCholesterol: boolean;
  cholesterolNotes: string | null;
  hasAllergiesAsthma: boolean;
  allergiesAsthmaNotes: string | null;
  hasLiverDisease: boolean;
  liverDiseaseNotes: string | null;
  hasGallbladderDisease: boolean;
  gallbladderDiseaseNotes: string | null;
  hasKidneyDisease: boolean;
  kidneyDiseaseNotes: string | null;
  hasStomachDisease: boolean;
  stomachDiseaseNotes: string | null;
  hasUricAcidGout: boolean;
  uricAcidGoutNotes: string | null;
  hasCirculationIssues: boolean;
  circulationIssuesNotes: string | null;
  hasThyroidIssues: boolean;
  thyroidIssuesNotes: string | null;
  hasAnemia: boolean;
  anemiaNotes: string | null;
  hasConstipation: boolean;
  constipationNotes: string | null;
  hasMusculoskeletalIssues: boolean;
  musculoskeletalIssuesNotes: string | null;
  hasSurgeries: boolean;
  surgeriesNotes: string | null;
  hasMenstrualCycleIssues: boolean;
  menstrualCycleIssuesNotes: string | null;
  hasSleepIssues: boolean;
  sleepIssuesNotes: string | null;
}

export type UpdateUserTenantProfileRequest = UserTenantProfileDto;

export interface UserTenantProfileFixedMealsDto {
  breakfast: string | null;
  snack: string | null;
  lunch: string | null;
  observations: string | null;
}

export interface AppUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  createdAt: string;
  memberships: TenantMembershipDto[];
  /**
   * Superadministrador de plataforma. Siempre viene en `GET /users/me` y en
   * `GET /tenant/{id}/users/me`, nunca en los listados de usuarios de un centro.
   * Si es `true`, `memberships` suele estar vacio aunque tenga acceso total.
   */
  superAdmin?: boolean;
  enabled?: boolean;
  roleCode?: string;
  roleName?: string;
  permissions?: string[];
  disabledAt?: string | null;
  birthDate?: string | null;
  age?: number | null;
  heightCm?: number | null;
  gender?: Gender | null;
  /** Zona horaria IANA del usuario (p. ej. `Europe/Madrid`). */
  timezone?: string | null;
  /** Código ISO del idioma del usuario (p. ej. `es`, `en`). */
  language?: string | null;
  lastMeasurement?: BodyMeasurementDto | null;
  userType?: UserType;
  /** Titular nutritionist assigned to this patient in the active tenant (V45). */
  assignedNutritionistId?: string | null;
  /** Full name of the titular nutritionist, ready to display. */
  assignedNutritionistName?: string | null;
  /** Estado clínico del paciente en este centro (P1). */
  clinicalStatus?: ClinicalStatus | null;
  /** Motivo del último cambio de estado clínico. */
  clinicalStatusReason?: string | null;
  /** Fecha del último cambio de estado clínico (ISO-8601 UTC). */
  clinicalStatusChangedAt?: string | null;
  /** Fecha de alta del usuario en este centro (ISO-8601 UTC). */
  joinedAt?: string | null;
  /** Inicio de la última cita `COMPLETED` del paciente en el centro (T7). */
  lastVisitDate?: string | null;
  /** Inicio de la última cita `NO_SHOW` del paciente en el centro (T7). */
  lastNoShowDate?: string | null;
  /** Inicio de la próxima cita `SCHEDULED`/`PROPOSED` vigente (ISO-8601 UTC). */
  nextAppointmentDate?: string | null;
}
