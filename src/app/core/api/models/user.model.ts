import { BodyMeasurementDto } from './body-measurement.model';

export type UserType = 'STAFF' | 'PATIENT';

export interface TenantMembershipDto {
  tenantId: string;
  tenantName: string;
  roleCode: string;
  permissions: string[];
  userType?: UserType;
}

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
  lastMeasurement?: BodyMeasurementDto | null;
  userType?: UserType;
}
