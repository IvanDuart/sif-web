import { BodyMeasurementDto } from './body-measurement.model';

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
