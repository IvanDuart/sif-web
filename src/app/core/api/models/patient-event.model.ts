export interface PatientEventDto {
  id: string;
  tenantId: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string | null;
  createdAt: string;
}

export interface CreatePatientEventRequest {
  title: string;
  description?: string | null;
  startTime: string;
  endTime?: string | null;
}

export interface UpdatePatientEventRequest {
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string | null;
}
