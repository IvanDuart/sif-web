export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'PROPOSED';

export interface AppointmentDto {
  id: string;
  tenantId: string;
  nutritionistId: string;
  nutritionistName: string;
  patientId?: string | null;
  patientName?: string | null;
  typeId: string | null;
  typeName: string | null;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes: string | null;
  createdAt: string;
}

export interface CreateAppointmentRequest {
  /**
   * Optional since V45. Staff must still provide it (backend responds 400
   * `error.appointment_nutritionist_required` when missing); patients omit it
   * and the backend resolves their titular nutritionist.
   */
  nutritionistId?: string;
  patientId?: string;
  patientName?: string;
  startTime: string;
  endTime?: string;
  typeId?: string;
  notes?: string;
  /**
   * Allows the new appointment to overlap another one of the same nutritionist.
   * Only effective for staff with `MANAGE_APPOINTMENTS`; ignored for patients.
   */
  allowOverlap?: boolean;
}

export interface UpdateAppointmentStatusRequest {
  status: Extract<AppointmentStatus, 'COMPLETED' | 'CANCELLED' | 'NO_SHOW'>;
}

export interface RescheduleAppointmentRequest {
  startTime?: string;
  endTime?: string;
  typeId?: string;
  notes?: string;
  /**
   * Allows moving the appointment to a slot that overlaps another one of the
   * same nutritionist. Only effective for staff with `MANAGE_APPOINTMENTS`.
   */
  allowOverlap?: boolean;
}

export interface NutritionistPatientDto {
  patientId: string;
  firstName: string;
  lastName: string;
  email: string;
  lastAppointment: string | null;
  nextAppointment: string | null;
}
