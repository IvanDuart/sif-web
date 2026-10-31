import {
  normalizeDayOfWeek,
  normalizeMealType,
  toApiDayOfWeek,
  toApiMealType,
} from './meal-enums';

describe('meal-enums', () => {
  it('normaliza los valores ingleses de la API al formato legacy de la UI', () => {
    expect(normalizeDayOfWeek('MONDAY')).toBe('LUNES');
    expect(normalizeDayOfWeek('WEDNESDAY')).toBe('MIERCOLES');
    expect(normalizeDayOfWeek('OTHER')).toBe('FESTIVO');
    expect(normalizeMealType('BREAKFAST')).toBe('DESAYUNO');
    expect(normalizeMealType('MID_MORNING')).toBe('MEDIA_MAÑANA');
    expect(normalizeMealType('LUNCH')).toBe('COMIDA');
    expect(normalizeMealType('SNACK')).toBe('MERIENDA');
    expect(normalizeMealType('DINNER')).toBe('CENA');
  });

  it('conserva los valores legacy y acepta tildes', () => {
    expect(normalizeDayOfWeek('MIÉRCOLES')).toBe('MIERCOLES');
    expect(normalizeMealType('ALMUERZO')).toBe('ALMUERZO');
  });

  it('convierte la UI al nombre inglés que espera la API', () => {
    expect(toApiDayOfWeek('LUNES')).toBe('MONDAY');
    expect(toApiDayOfWeek('MIERCOLES')).toBe('WEDNESDAY');
    expect(toApiMealType('COMIDA')).toBe('LUNCH');
    expect(toApiMealType('ALMUERZO')).toBe('LUNCH');
    expect(toApiMealType('CENA')).toBe('DINNER');
  });

  it('deja pasar valores ya normalizados y no rompe con vacíos', () => {
    expect(toApiDayOfWeek('MONDAY')).toBe('MONDAY');
    expect(toApiMealType('BREAKFAST')).toBe('BREAKFAST');
    expect(toApiDayOfWeek(null)).toBeUndefined();
    expect(normalizeDayOfWeek(undefined)).toBe('');
  });
});
