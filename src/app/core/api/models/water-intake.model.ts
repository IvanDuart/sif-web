export interface WaterIntakeDto {
  id: string;
  tenantId: string;
  patientId: string;
  recordDate: string; // YYYY-MM-DD
  amountMl: number;
  isGoalReached: boolean;
}

export interface UpdateWaterIntakeRequest {
  amountMl: number;
}
