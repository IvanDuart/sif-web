export interface AppointmentTypeDto {
  id: string;
  tenantId: string;
  name: string;
  durationMinutes: number;
  price: number;
  isDefault: boolean;
  isActive: boolean;
  color: string;
  createdAt: string;
}

export interface CreateAppointmentTypeRequest {
  name: string;
  durationMinutes: number;
  price: number;
  isDefault?: boolean;
  color?: string;
}

export interface UpdateAppointmentTypeRequest {
  name?: string;
  durationMinutes?: number;
  price?: number;
  isDefault?: boolean;
  isActive?: boolean;
  color?: string;
}
