import { withParam } from '../descriptor';
import { MEAL_EXCHANGES_OPENER, exchangeKeys, exchangesAccess, mealExchangesSurface } from './meal-exchanges.surface';

describe('raciones de intercambio de una comida', () => {
  const groups = [
    { id: 'g-1', name: 'Farináceos' },
    { id: 'g-2', name: 'Lácteos' },
    { id: 'g-3', name: 'lacteos' },
  ];

  it('cada grupo se nombra por su nombre legible, sin acentos, y sin chocar', () => {
    expect([...exchangeKeys(groups).values()]).toEqual(['farinaceos', 'lacteos', 'lacteos_2']);
  });

  it('un campo de número por grupo, que se reconoce también por el id del backend', () => {
    const surface = mealExchangesSurface({ groups: () => groups, ready: () => true, mealId: () => 'meal-1' });
    expect(surface.fields.map((field) => field.key)).toEqual(['farinaceos', 'lacteos', 'lacteos_2']);
    expect(surface.fields[0].from).toEqual(['g-1', 'Farináceos']);
    expect(surface.fields[0].parse?.('1,5 raciones')).toBe(1.5);
    expect(surface.tools).toEqual(['update_meal_exchanges']);
    expect(surface.subject?.()).toBe('meal-1');
  });

  it('los campos se leen al momento: los grupos llegan por HTTP', () => {
    let loaded: typeof groups = [];
    const surface = mealExchangesSurface({ groups: () => loaded, ready: () => loaded.length > 0, mealId: () => null });
    expect(surface.fields).toEqual([]);
    loaded = groups;
    expect(surface.fields.length).toBe(3);
  });

  it('escribe y lee la fila del grupo por su clave', () => {
    const values = new Map<string, number | null>();
    const access = exchangesAccess({
      groups: () => groups,
      get: (id) => values.get(id) ?? null,
      set: (id, value) => values.set(id, value),
    });

    access.set('lacteos_2', 2);
    access.set('farinaceos', '');
    access.set('no_existe', 4);

    expect(values.get('g-3')).toBe(2);
    expect(values.get('g-1')).toBeNull();
    expect(values.size).toBe(2);
    expect(access.get('lacteos_2')).toBe(2);
  });

  it('se abre pulsando la comida pedida, y sólo si el centro usa intercambios', () => {
    expect(MEAL_EXCHANGES_OPENER.requires).toBe('exchanges');
    expect(withParam(MEAL_EXCHANGES_OPENER, { mealId: 'abc-123' })?.trigger).toBe('[data-mascot-meal="abc-123"]');
    expect(withParam(MEAL_EXCHANGES_OPENER, { mealId: 'a"]' })).toBeNull();
  });
});
