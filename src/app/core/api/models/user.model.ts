export interface TenantMembershipDto {
  tenantId: string;
  tenantName: string;
  roleCode: string;
  permissions: string[];
}

export interface AppUserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: string;
  memberships: TenantMembershipDto[];
  enabled?: boolean;
}
