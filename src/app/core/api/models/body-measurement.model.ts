export type BmiClassification = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY_CLASS_I' | 'OBESITY_CLASS_II' | 'OBESITY_CLASS_III';
export type BoneMassEvaluation = 'LOW' | 'NORMAL' | 'HIGH' | 'NOT_EVALUATED';
export type BodyFrame = 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN';
export type BodySegment = 'TRUNK' | 'RIGHT_ARM' | 'LEFT_ARM' | 'RIGHT_LEG' | 'LEFT_LEG';

export interface SegmentalResult {
  segment: BodySegment;
  localizedSegmentName: string;
  fatPct: number;
  totalMassKg: number;
  fatMassKg: number;
  leanMassKg: number;
}

export interface LateralSymmetryResult {
  extremityType: string;
  rightLeanMassKg: number;
  leftLeanMassKg: number;
  diffKg: number;
  diffPct: number;
  asymmetricAlert: boolean;
  localizedObservation: string;
}

export interface SymmetryAnalysisResult {
  upperLimbs: LateralSymmetryResult;
  lowerLimbs: LateralSymmetryResult;
  thresholdPct: number;
  hasAnyAsymmetryAlert: boolean;
}

export interface BoneCompositionResult {
  boneMassKg: number;
  boneMassPctOfWeight: number;
  evaluation: BoneMassEvaluation;
  localizedDescription: string;
}

export interface BodyFrameResult {
  rIndex: number;
  frame: BodyFrame;
  localizedDescription: string;
}

export interface BodyCompositionReport {
  patient: {
    gender: 'MALE' | 'FEMALE';
    ageYears: number;
    heightCm: number;
    weightKg: number;
    wristCircumferenceCm?: number | null;
  };
  global: {
    bmi: number;
    bmiClassification: BmiClassification;
    localizedBmiClassification: string;
    fatMassKg: number;
    fatFreeMassKg: number;
    waterMassKg: number;
    boneComposition: BoneCompositionResult;
  };
  bodyFrame: BodyFrameResult;
  segmentalAnalysis: Record<BodySegment, SegmentalResult>;
  symmetry: SymmetryAnalysisResult;
  language: string;
  calculatedAt: string;
}

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
  wristCircumferenceCm?: number | null;
  boneMassKg?: number | null;
  trunkFatPct?: number | null;
  trunkMassKg?: number | null;
  rightArmFatPct?: number | null;
  rightArmMassKg?: number | null;
  leftArmFatPct?: number | null;
  leftArmMassKg?: number | null;
  rightLegFatPct?: number | null;
  rightLegMassKg?: number | null;
  leftLegFatPct?: number | null;
  leftLegMassKg?: number | null;
  bodyCompositionReport?: BodyCompositionReport | null;
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
  wristCircumferenceCm?: number | null;
  boneMassKg?: number | null;
  trunkFatPct?: number | null;
  trunkMassKg?: number | null;
  rightArmFatPct?: number | null;
  rightArmMassKg?: number | null;
  leftArmFatPct?: number | null;
  leftArmMassKg?: number | null;
  rightLegFatPct?: number | null;
  rightLegMassKg?: number | null;
  leftLegFatPct?: number | null;
  leftLegMassKg?: number | null;
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
  wristCircumferenceCm?: number | null;
  boneMassKg?: number | null;
  trunkFatPct?: number | null;
  trunkMassKg?: number | null;
  rightArmFatPct?: number | null;
  rightArmMassKg?: number | null;
  leftArmFatPct?: number | null;
  leftArmMassKg?: number | null;
  rightLegFatPct?: number | null;
  rightLegMassKg?: number | null;
  leftLegFatPct?: number | null;
  leftLegMassKg?: number | null;
}

export interface MeasurementHistoryDto {
  userId: string;
  tenantId: string;
  heightCm: number | null;
  points: MeasurementPoint[];
}
