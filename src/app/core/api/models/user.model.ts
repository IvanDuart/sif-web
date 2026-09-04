import { BodyCompositionReport, BodyMeasurementDto } from './body-measurement.model';

export type UserType = 'STAFF' | 'PATIENT';
export type Gender = 'MALE' | 'FEMALE';

export interface TenantMembershipDto {
  tenantId: string;
  tenantName: string;
  roleCode: string;
  permissions: string[];
  userType?: UserType;
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

export interface AppUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  createdAt: string;
  memberships: TenantMembershipDto[];
  enabled?: boolean;
  roleCode?: string;
  roleName?: string;
  permissions?: string[];
  disabledAt?: string | null;
  birthDate?: string | null;
  age?: number | null;
  heightCm?: number | null;
  gender?: Gender | null;
  lastMeasurement?: BodyMeasurementDto | null;
  userType?: UserType;
}
