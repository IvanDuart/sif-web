export type BmiClassification = 'UNDERWEIGHT' | 'NORMAL' | 'OVERWEIGHT' | 'OBESITY_CLASS_I' | 'OBESITY_CLASS_II' | 'OBESITY_CLASS_III';
/** Clasificación de % de grasa corporal.
 *  `OBESE` se retiró en la v2 del informe: el primer tramo por exceso es `OVERWEIGHT`.
 *  El backend mapea los informes cacheados con `OBESE` a `OVERWEIGHT` al deserializar. */
export type BodyFatClassification = 'LOW' | 'NORMAL' | 'OVERWEIGHT' | 'OBESE_CLASS_I' | 'OBESE_CLASS_II' | 'OBESE_CLASS_III';

/** Procedencia de un valor del informe (v2). */
export type MeasurementSource = 'MEASURED' | 'CARRIED_FORWARD' | 'ESTIMATED' | 'NOT_AVAILABLE';
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
  /** `MEASURED` si la báscula reportó la masa del segmento; `ESTIMATED` si procede del reparto anatómico. */
  totalMassSource?: MeasurementSource | null;
}

/** Comparación bilateral de un par de extremidades. Mide **dos magnitudes distintas**
 *  con requisitos distintos: el % de grasa basta con tener lectura en ambos lados; la masa
 *  magra exige que la masa esté medida (`leanMassComparable`). */
export interface LateralSymmetryResult {
  extremityType: string;

  /** Diferencia de % de grasa, en **puntos porcentuales** (no en % de variación). */
  rightFatPct?: number | null;
  leftFatPct?: number | null;
  fatPctDiffPoints?: number | null;
  fatPctAlert: boolean;

  /** `false` si alguna de las dos masas está repartida por factor anatómico;
   *  entonces los cinco campos de masa magra son `null`. */
  leanMassComparable: boolean;
  rightLeanMassKg?: number | null;
  leftLeanMassKg?: number | null;
  leanMassDiffKg?: number | null;
  leanMassDiffPct?: number | null;
  leanMassAlert: boolean;

  /** OR de `fatPctAlert` y `leanMassAlert`. */
  asymmetricAlert: boolean;
  localizedObservation: string;
}

/** Bloque de simetría. **Anulable en su conjunto y por extremidad**: es `null` si ningún
 *  par tiene % de grasa en los dos lados. */
export interface SymmetryAnalysisResult {
  upperLimbs?: LateralSymmetryResult | null;
  lowerLimbs?: LateralSymmetryResult | null;
  /** Umbral de la masa magra, en % de variación. */
  thresholdPct: number;
  /** Umbral de la grasa, en puntos porcentuales. Cribado pragmático, no estándar publicado. */
  fatPctThresholdPoints: number;
  hasAnyAsymmetryAlert: boolean;
}

export interface BoneCompositionResult {
  boneMassKg?: number | null;
  boneMassPctOfWeight?: number | null;
  evaluation: BoneMassEvaluation;
  localizedDescription: string;
  /** Procedencia de la masa ósea (v2). */
  source?: MeasurementSource | null;
  /** Fecha de la medición de la que se hereda. `null` si procede del perfil del paciente. */
  carriedFrom?: string | null;
}

export interface BodyFrameResult {
  rIndex: number;
  frame: BodyFrame;
  localizedDescription: string;
}

export interface ReferenceRangesResult {
  normalWeightMinKg: number;
  normalWeightMaxKg: number;
  fatMassPctMin: number;
  fatMassPctMax: number;
  fatFreeMassMinKg: number;
  fatFreeMassMaxKg: number;
  waterMassMinKg: number;
  waterMassMaxKg: number;
  boneMassMinKg: number;
  boneMassMaxKg: number;
}

export interface BodyCompositionReport {
  patient: {
    gender: 'MALE' | 'FEMALE';
    ageYears: number;
    heightCm: number;
    weightKg: number;
    wristCircumferenceCm?: number | null;
    waistCm?: number | null;
  };
  global: {
    bmi: number;
    bmiClassification: BmiClassification;
    localizedBmiClassification: string;
    bodyFatClassification?: BodyFatClassification | null;
    localizedBodyFatClassification?: string | null;
    fatMassKg: number;
    fatFreeMassKg: number;
    waterMassKg: number;
    visceralFatLevel?: number | null;
    /** Procedencia del nivel de grasa visceral (v2). Ya no se estima. */
    visceralFatSource?: MeasurementSource | null;
    /** Fecha de la medición de la que se hereda el VFL. */
    visceralFatCarriedFrom?: string | null;
    boneComposition: BoneCompositionResult;
  };
  bodyFrame: BodyFrameResult;
  /** Solo contiene los segmentos con `fatPct` propio: puede llegar vacío o incompleto. */
  segmentalAnalysis: Partial<Record<BodySegment, SegmentalResult>>;
  /** `null` si ningún par tiene % de grasa en ambos lados. */
  symmetry?: SymmetryAnalysisResult | null;
  referenceRanges?: ReferenceRangesResult | null;
  language: string;
  calculatedAt: string;
}

export interface BodyMeasurementDto {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  muscleMassPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  contourCm: number | null;
  armCm: number | null;
  bodyWaterPct: number | null;
  visceralFatLevel?: number | null;
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
  muscleMassPct?: number | null;
  waistCm?: number | null;
  chestCm?: number | null;
  hipsCm?: number | null;
  contourCm?: number | null;
  armCm?: number | null;
  bodyWaterPct?: number | null;
  visceralFatLevel?: number | null;
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
  muscleMassPct: number | null;
  waistCm: number | null;
  chestCm: number | null;
  hipsCm: number | null;
  contourCm: number | null;
  armCm: number | null;
  bodyWaterPct: number | null;
  visceralFatLevel?: number | null;
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
