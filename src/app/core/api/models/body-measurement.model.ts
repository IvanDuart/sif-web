export interface BodyMeasurementDto {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  contourCm: number | null;
  armCm: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
}

export interface CreateBodyMeasurementRequest {
  weightKg?: number | null;
  bodyFatPct?: number | null;
  muscleMassKg?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  hipsCm?: number | null;
  contourCm?: number | null;
  armCm?: number | null;
  bodyWaterPct?: number | null;
  measuredAt?: string | null;
  notes?: string | null;
}

export interface MeasurementPoint {
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  contourCm: number | null;
  armCm: number | null;
  bodyWaterPct: number | null;
  bmi: number | null;
}

export interface MeasurementHistoryDto {
  userId: string;
  tenantId: string;
  heightCm: number | null;
  points: MeasurementPoint[];
}
