import { LOOK_KEY, cleanAccessories, readLook, readStoredLook, writeLook } from './storage';
import { DEFAULT_SKIN } from './types';

describe('look storage', () => {
  const AYER = '2026-10-31T09:00:00.000Z';

  beforeEach(() => localStorage.clear());

  it('lee el look por defecto cuando no hay nada guardado', () => {
    expect(readLook()).toEqual(jasmine.objectContaining({ skin: DEFAULT_SKIN, accessories: [] }));
  });

  it('guarda y recupera skin y accesorios', () => {
    writeLook({ skin: 'manzana', accessories: ['orejas'], updatedAt: AYER });

    expect(readLook()).toEqual(jasmine.objectContaining({ skin: 'manzana', accessories: ['orejas'] }));
  });

  it('ignora accesorios desconocidos', () => {
    expect(cleanAccessories(['orejas', 'sombrero'])).toEqual(['orejas']);
  });

  it('cae al look por defecto si el JSON está roto', () => {
    localStorage.setItem(LOOK_KEY, '{');

    expect(readLook()).toEqual(jasmine.objectContaining({ skin: DEFAULT_SKIN, accessories: [] }));
  });

  it('acepta un id de skin suelto (formato antiguo)', () => {
    localStorage.setItem(LOOK_KEY, 'melon');

    expect(readLook()).toEqual(jasmine.objectContaining({ skin: 'melon', accessories: [] }));
  });

  it('no inventa una elección cuando no hay nada guardado', () => {
    expect(readStoredLook()).toBeNull();
  });

  it('distingue la elección guardada aunque coincida con la por defecto', () => {
    writeLook({ skin: DEFAULT_SKIN, accessories: [], updatedAt: AYER });

    expect(readStoredLook()).toEqual(jasmine.objectContaining({ skin: DEFAULT_SKIN, accessories: [] }));
  });

  it('no toma por elección un JSON roto', () => {
    localStorage.setItem(LOOK_KEY, '{');

    expect(readStoredLook()).toBeNull();
  });
});
