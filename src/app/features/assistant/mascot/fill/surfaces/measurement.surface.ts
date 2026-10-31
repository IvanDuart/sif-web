import type { FillField, FillOpener, FillSurface } from '../descriptor';

/**
 * El formulario de medidas (`users/measurement-form.dialog`). Es el caso
 * completo: campos numéricos repartidos en cuatro pasos, de los que sólo uno
 * está en el DOM a la vez, así que la mascota pulsa el paso antes de escribir
 * en él (`reveal`).
 */

/** Un número del formulario: se teclea cifra a cifra y se guarda como número. */
const metric = (key: string, step: number, from: readonly string[]): FillField => ({
  key,
  kind: 'number',
  from: [key, ...from],
  reveal: `[data-mascot-reveal="measurement-step-${step}"]`,
  parse: toNumber,
});

/** Lo que manda el backend es texto ("72,5 kg"); el formulario quiere un número. */
export function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

export const MEASUREMENT_SURFACE: FillSurface = {
  id: 'measurement',
  tools: ['create_measurement', 'update_measurement'],
  fields: [
    metric('weightKg', 1, ['weight', 'peso', 'pesoKg']),
    metric('heightCm', 1, ['height', 'altura', 'alturaCm', 'tallaCm']),
    metric('bodyFatPct', 1, ['bodyFat', 'grasa', 'grasaCorporal']),
    metric('muscleMassPct', 1, ['muscleMass', 'masaMuscular']),
    metric('bodyWaterPct', 1, ['bodyWater', 'agua']),
    metric('visceralFatLevel', 1, ['visceralFat', 'grasaVisceral']),
    metric('boneMassKg', 1, ['boneMass', 'masaOsea']),

    metric('waistCm', 2, ['waist', 'cintura']),
    metric('chestCm', 2, ['chest', 'pecho']),
    metric('hipsCm', 2, ['hips', 'cadera']),
    metric('contourCm', 2, ['contour', 'contorno']),
    metric('armCm', 2, ['arm', 'brazo']),
    metric('wristCircumferenceCm', 2, ['wrist', 'muneca']),

    metric('trunkFatPct', 3, ['trunkFat']),
    metric('trunkMassKg', 3, ['trunkMass']),
    metric('rightArmFatPct', 3, ['rightArmFat']),
    metric('rightArmMassKg', 3, ['rightArmMass']),
    metric('leftArmFatPct', 3, ['leftArmFat']),
    metric('leftArmMassKg', 3, ['leftArmMass']),
    metric('rightLegFatPct', 3, ['rightLegFat']),
    metric('rightLegMassKg', 3, ['rightLegMass']),
    metric('leftLegFatPct', 3, ['leftLegFat']),
    metric('leftLegMassKg', 3, ['leftLegMass']),

    {
      key: 'notes',
      kind: 'text',
      from: ['notes', 'notas', 'observaciones'],
      reveal: '[data-mascot-reveal="measurement-step-4"]',
    },
  ],
};

/**
 * Cómo abre la mascota el diálogo de medidas desde la ficha del paciente:
 * pulsando el mismo botón de "Registrar Medición" que pulsaría una persona.
 * Lo registra `user-detail.page`, que es quien lo tiene.
 */
export const MEASUREMENT_OPENER: FillOpener = {
  id: MEASUREMENT_SURFACE.id,
  tools: MEASUREMENT_SURFACE.tools,
  trigger: '[data-mascot-open="measurement"]',
};
