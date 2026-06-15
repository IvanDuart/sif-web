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
}

export type UpdateUserTenantProfileRequest = UserTenantProfileDto;

export interface AppUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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
