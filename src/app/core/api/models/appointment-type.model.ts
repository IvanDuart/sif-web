export interface AppointmentTypeDto {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface CreateAppointmentTypeRequest {
  name: string;
  durationMinutes: number;
  isDefault?: boolean;
}

export interface UpdateAppointmentTypeRequest {
  name?: string;
  durationMinutes?: number;
  isDefault?: boolean;
  isActive?: boolean;
}
