export interface ScheduleDetailDto {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ScheduleDto {
  id: string;
  name: string;
  color: string;
  details: ScheduleDetailDto[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantScheduleAssignmentDto {
  id: string;
  scheduleId: string;
  year: number;
  validFrom: string;
  validTo: string | null;
  schedule: ScheduleDto;
}

export interface CreateScheduleRequest {
  name: string;
  color: string;
  details: Omit<ScheduleDetailDto, 'id'>[];
}

export type UpdateScheduleRequest = CreateScheduleRequest;

export interface CreateScheduleAssignmentRequest {
  scheduleId: string;
  year: number;
  validFrom: string;
  validTo?: string | null;
}

export type UpdateScheduleAssignmentRequest = CreateScheduleAssignmentRequest;
