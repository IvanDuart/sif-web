export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'PROPOSED';

export interface AppointmentDto {
  id: string;
  tenantId: string;
  nutritionistId: string;
  nutritionistName: string;
  patientId: string;
  patientName: string;
  typeId: string | null;
  typeName: string | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  nutritionistId: string;
  patientId: string;
  startTime: string;
  endTime?: string;
  typeId?: string;
  notes?: string;
}

export interface UpdateAppointmentStatusRequest {
  status: Extract<AppointmentStatus, 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'>;
}

export interface RescheduleAppointmentRequest {
  startTime?: string;
  endTime?: string;
  typeId?: string;
  notes?: string;
}

export interface NutritionistPatientDto {
  patientId: string;
  firstName: string;
  lastName: string;
  email: string;
  lastAppointment: string | null;
  nextAppointment: string | null;
}
