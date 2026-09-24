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
  /** Momento en que la cita pasó a `CANCELLED`. `null` si no aplica. */
  cancelledAt?: string | null;
  /**
   * Horas de antelación con que se canceló respecto a `startTime`.
   * Positivo = avisó con margen. `null` en cancelaciones históricas.
   */
  cancellationNoticeHours?: number | null;
}

/** Granularidad de la serie temporal del panel de métricas. */
export type MetricsGranularity = 'DAY' | 'WEEK' | 'MONTH' | 'QUARTER';

export interface AppointmentMetricsRangeDto {
  from: string;
  to: string;
}

export interface RevenueMetricsDto {
  total: number;
  currency: string;
  completedAppointments: number;
  averageTicket: number;
  patientsSeen: number;
}

export interface AttendanceMetricsDto {
  scheduled: number;
  attended: number;
  attendanceRate: number;
  noShow: number;
  cancelledInTime: number;
  cancelledLate: number;
  /** Siempre `null` por ahora: no existe el concepto de lista de espera. */
  recoveredSlots: number | null;
  /** Objetivo del centro normalizado a 0..1. */
  targetRate: number;
}

export interface NutritionistMetricsDto {
  nutritionistId: string;
  nutritionistName: string;
  revenue: number;
  scheduled: number;
  attended: number;
  attendanceRate: number;
  noShow: number;
}

export interface ServiceTypeMetricsDto {
  typeId: string | null;
  typeName: string;
  revenue: number;
  scheduled: number;
  attended: number;
  attendanceRate: number;
  noShow: number;
}

export interface TimeBandMetricsDto {
  label: string;
  scheduled: number;
  attended: number;
  attendanceRate: number;
}

/** Punto de una serie temporal (`series.revenue` / `series.attendanceRate`). */
export interface MetricsSeriesPointDto {
  label: string;
  from: string;
  to: string;
  value: number;
  /** Solo en `attendanceRate`: citas programadas del cubo (para contexto). */
  scheduled?: number;
}

export interface AppointmentMetricsSeriesDto {
  granularity: MetricsGranularity;
  revenue: MetricsSeriesPointDto[];
  attendanceRate: MetricsSeriesPointDto[];
}

export interface AppointmentMetricsDto {
  range: AppointmentMetricsRangeDto;
  revenue: RevenueMetricsDto;
  attendance: AttendanceMetricsDto;
  /** Vacío sin `MANAGE_TENANT` (no se expone el desglose del centro). */
  byNutritionist: NutritionistMetricsDto[];
  /** Vacío sin `MANAGE_TENANT`. */
  byServiceType: ServiceTypeMetricsDto[];
  byTimeBand: TimeBandMetricsDto[];
  series: AppointmentMetricsSeriesDto;
}

export interface AppointmentMetricsQuery {
  /** ISO-8601, inclusive. */
  from: string;
  /** ISO-8601, inclusive. */
  to: string;
  /** Solo se respeta con `MANAGE_TENANT`. */
  nutritionistId?: string;
  granularity?: MetricsGranularity;
  /** Nº de cubos de la serie (1..60). El último es el que contiene `to`. */
  bucketCount?: number;
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
