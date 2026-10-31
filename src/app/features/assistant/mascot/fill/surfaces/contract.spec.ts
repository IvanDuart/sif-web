import { matchPreview, unmatchedPreview, type FillSurface } from '../descriptor';
import { appointmentSurface } from './appointment.surface';
import { holidaySurface } from './holiday.surface';
import { MEASUREMENT_SURFACE } from './measurement.surface';
import { PATIENT_PROFILE_SURFACE } from './patient-profile.surface';
import { scheduleAssignmentSurface } from './schedule-assignment.surface';
import { scheduleSurface } from './schedule.surface';

/**
 * El contrato de nombres entre el backend y los formularios.
 *
 * Cada `preview[].field` que el backend promete mandar tiene que caer en un
 * campo del formulario. Si no cae, no salta ningún error: la acción se queda en
 * la tarjeta de confirmar y la mascota deja de rellenar **en silencio**. Por eso
 * el contrato se prueba entero aquí, nombre a nombre, en lugar de confiar en
 * que alguien se dé cuenta.
 *
 * Esto cubre nuestro lado: que no renombremos un campo sin enterarnos. El lado
 * del backend lo vigila `unmatchedPreview()`, que avisa por consola cuando
 * llega un nombre que no reconocemos.
 *
 * Las tablas están en `doc/assistant-backend-peticion.md` §2 (tools de
 * paciente) y `doc/assistant-tools-backend.md` §3.1 (configuración del centro).
 * **Si cambia una, cambia la otra.**
 */

/** Lo que el formulario tiene que saber hacer con lo que le mandan. */
function expectContract(surface: FillSurface, preview: Record<string, string>): void {
  const items = Object.entries(preview).map(([field, value]) => ({ field, value }));

  // 1. Reconoce todos los nombres.
  expect(unmatchedPreview(surface, items)).toEqual([]);

  // 2. Y todos llegan a un campo: ninguno se pierde por el camino.
  const matched = matchPreview(surface, items);
  expect(matched.length).toBe(items.length);

  // 3. Y sabe leer el valor: un formato que cambie deja el campo en nada.
  const unreadable = matched
    .filter(({ field, raw }) => field.parse !== undefined && field.parse(raw) === null)
    .map(({ field }) => field.key);
  expect(unreadable).toEqual([]);
}

describe('contrato del preview', () => {
  describe('create_measurement', () => {
    /** Los 23 números del formulario de medidas, por el paso en que viven. */
    const METRICS = [
      // Paso 1 — composición
      'weightKg', 'heightCm', 'bodyFatPct', 'muscleMassPct', 'bodyWaterPct', 'visceralFatLevel', 'boneMassKg',
      // Paso 2 — perímetros
      'waistCm', 'chestCm', 'hipsCm', 'contourCm', 'armCm', 'wristCircumferenceCm',
      // Paso 3 — segmentos
      'trunkFatPct', 'trunkMassKg',
      'rightArmFatPct', 'rightArmMassKg', 'leftArmFatPct', 'leftArmMassKg',
      'rightLegFatPct', 'rightLegMassKg', 'leftLegFatPct', 'leftLegMassKg',
    ];

    it('rellena esta tool', () => {
      // `update_measurement` todavía no existe en el backend; el formulario ya
      // la espera (`doc/assistant-tools-backend.md` §8).
      expect(MEASUREMENT_SURFACE.tools).toContain('create_measurement');
    });

    it('reconoce los 23 números y las notas', () => {
      expect(METRICS.length).toBe(23);
      expectContract(MEASUREMENT_SURFACE, {
        ...Object.fromEntries(METRICS.map((field) => [field, '70'])),
        notes: 'Viene en ayunas.',
      });
    });

    it('acepta el número tal y como lo escribe el backend, con su unidad', () => {
      const [{ field, raw }] = matchPreview(MEASUREMENT_SURFACE, [{ field: 'weightKg', value: '72,5 kg' }]);
      expect(field.parse?.(raw)).toBe(72.5);
    });
  });

  describe('create_appointment / reschedule_appointment', () => {
    const surface = appointmentSurface({
      patients: () => [{ label: 'Ana García', value: 'p-1' }],
      nutritionists: () => [{ label: 'Nelson Muntz', value: 'n-1' }],
      types: () => [{ label: 'Primera consulta', value: 't-1' }],
    });

    it('rellena estas tools', () => {
      expect(surface.tools).toEqual(['create_appointment', 'reschedule_appointment']);
    });

    it('reconoce los seis campos, con la gente nombrada por su nombre', () => {
      expectContract(surface, {
        patientId: 'Ana García',
        nutritionistId: 'Nelson Muntz',
        typeId: 'Primera consulta',
        date: '2026-11-05',
        time: '10:00',
        notes: 'Revisión de la dieta.',
      });
    });

    it('parte un `scheduledAt` suelto en el día y la hora del formulario', () => {
      const matched = matchPreview(surface, [{ field: 'scheduledAt', value: '2026-11-05 10:00' }]);
      expect(matched.map(({ field }) => field.key)).toEqual(['date', 'time']);
      expect(matched.every(({ field, raw }) => field.parse?.(raw) !== null)).toBeTrue();
    });

    it('casa por el nombre de pila cuando no hay duda', () => {
      const [{ field, raw }] = matchPreview(surface, [{ field: 'patientId', value: 'Ana' }]);
      expect(field.parse?.(raw)).toBe('p-1');
    });

    it('deja el desplegable en blanco antes que adivinar entre dos Anas', () => {
      const ambiguous = appointmentSurface({
        patients: () => [
          { label: 'Ana García', value: 'p-1' },
          { label: 'Ana Martínez', value: 'p-2' },
        ],
        nutritionists: () => [],
        types: () => [],
      });
      const [{ field, raw }] = matchPreview(ambiguous, [{ field: 'patientId', value: 'Ana' }]);
      expect(field.parse?.(raw)).toBeNull();
    });
  });

  describe('update_anamnesis / update_profile', () => {
    /** Los 18 antecedentes: su interruptor y sus notas, tal y como se nombran. */
    const ANAMNESIS: readonly (readonly [string, string])[] = [
      ['hasDiabetes', 'diabetesNotes'],
      ['hasHypertension', 'hypertensionNotes'],
      ['hasHeartDisease', 'heartDiseaseNotes'],
      ['hasCholesterol', 'cholesterolNotes'],
      ['hasAllergiesAsthma', 'allergiesAsthmaNotes'],
      ['hasLiverDisease', 'liverDiseaseNotes'],
      ['hasGallbladderDisease', 'gallbladderDiseaseNotes'],
      ['hasKidneyDisease', 'kidneyDiseaseNotes'],
      ['hasStomachDisease', 'stomachDiseaseNotes'],
      ['hasUricAcidGout', 'uricAcidGoutNotes'],
      ['hasCirculationIssues', 'circulationIssuesNotes'],
      ['hasThyroidIssues', 'thyroidIssuesNotes'],
      ['hasAnemia', 'anemiaNotes'],
      ['hasConstipation', 'constipationNotes'],
      ['hasMusculoskeletalIssues', 'musculoskeletalIssuesNotes'],
      ['hasSurgeries', 'surgeriesNotes'],
      ['hasMenstrualCycleIssues', 'menstrualCycleIssuesNotes'],
      ['hasSleepIssues', 'sleepIssuesNotes'],
    ];

    it('rellena estas tools', () => {
      expect(PATIENT_PROFILE_SURFACE.tools).toEqual(['update_anamnesis', 'update_profile']);
    });

    it('reconoce los 18 interruptores y sus 18 notas', () => {
      expect(ANAMNESIS.length).toBe(18);
      expectContract(PATIENT_PROFILE_SURFACE, Object.fromEntries(
        ANAMNESIS.flatMap(([flag, notes]) => [[flag, 'sí'], [notes, 'Desde 2019.']]),
      ));
    });

    it('entiende el sí y el no como los escribe el backend', () => {
      const read = (value: string) => {
        const [{ field, raw }] = matchPreview(PATIENT_PROFILE_SURFACE, [{ field: 'hasDiabetes', value }]);
        return field.parse?.(raw);
      };
      expect(['sí', 'si', 'true', '1', 'yes'].map(read)).toEqual([true, true, true, true, true]);
      expect(['no', 'false', '0'].map(read)).toEqual([false, false, false]);
    });
  });

  describe('configuración del centro', () => {
    it('create_schedule / update_schedule', () => {
      const surface = scheduleSurface({
        days: () => [{ label: 'Lunes', value: '1' }, { label: 'Martes', value: '2' }],
        blocks: () => 0,
      });
      expect(surface.tools).toEqual(['create_schedule', 'update_schedule']);
      expectContract(surface, {
        name: 'Horario de invierno',
        color: '#2E7D32',
        'details[0].dayOfWeek': 'Lunes',
        'details[0].startTime': '09:00',
        'details[0].endTime': '14:00',
        'details[1].dayOfWeek': '2',
        'details[1].startTime': '16:00',
        'details[1].endTime': '20:00',
      });
    });

    it('assign_schedule / update_schedule_assignment', () => {
      const surface = scheduleAssignmentSurface({
        schedules: () => [{ label: 'Horario de invierno', value: 's-1' }],
      });
      expect(surface.tools).toEqual(['assign_schedule', 'update_schedule_assignment']);
      expectContract(surface, {
        scheduleId: 'Horario de invierno',
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
      });
    });

    it('create_holiday', () => {
      const surface = holidaySurface({
        types: () => [{ label: 'Nacional', value: 'NATIONAL' }, { label: 'Local', value: 'LOCAL' }],
      });
      expect(surface.tools).toEqual(['create_holiday']);
      expectContract(surface, {
        holidayDate: '2026-12-25',
        description: 'Navidad',
        type: 'Nacional',
      });
    });
  });

  describe('cuando el contrato se mueve', () => {
    it('delata el nombre que no reconoce', () => {
      const orphans = unmatchedPreview(MEASUREMENT_SURFACE, [
        { field: 'weightKg', value: '70' },
        { field: 'pesoCorporal', value: '70' },
      ]);
      expect(orphans).toEqual(['pesoCorporal']);
    });

    it('no se queja de los campos que el backend manda vacíos a propósito', () => {
      const orphans = unmatchedPreview(MEASUREMENT_SURFACE, [{ field: 'loQueSea', value: '' }]);
      expect(orphans).toEqual([]);
    });

    it('también delata una fila con el campo mal nombrado', () => {
      const surface = scheduleSurface({ days: () => [{ label: 'Lunes', value: '1' }], blocks: () => 0 });
      const orphans = unmatchedPreview(surface, [
        { field: 'details[0].startTime', value: '09:00' },
        { field: 'details[0].horaDeInicio', value: '09:00' },
        { field: 'tramos[0].startTime', value: '09:00' },
      ]);
      expect(orphans).toEqual(['details[0].horaDeInicio', 'tramos[0].startTime']);
    });
  });
});
