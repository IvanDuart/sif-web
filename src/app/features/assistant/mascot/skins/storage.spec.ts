import { LOOK_KEY, cleanAccessories, readLook, writeLook } from './storage';
import { DEFAULT_SKIN } from './types';

describe('look storage', () => {
  beforeEach(() => localStorage.clear());

  it('lee el look por defecto cuando no hay nada guardado', () => {
    expect(readLook()).toEqual({ skin: DEFAULT_SKIN, accessories: [] });
  });

  it('guarda y recupera skin y accesorios', () => {
    writeLook({ skin: 'manzana', accessories: ['orejas'] });

    expect(readLook()).toEqual({ skin: 'manzana', accessories: ['orejas'] });
  });

  it('ignora accesorios desconocidos', () => {
    expect(cleanAccessories(['orejas', 'sombrero'])).toEqual(['orejas']);
  });

  it('cae al look por defecto si el JSON está roto', () => {
    localStorage.setItem(LOOK_KEY, '{');

    expect(readLook()).toEqual({ skin: DEFAULT_SKIN, accessories: [] });
  });

  it('acepta un id de skin suelto (formato antiguo)', () => {
    localStorage.setItem(LOOK_KEY, 'melon');

    expect(readLook()).toEqual({ skin: 'melon', accessories: [] });
  });
});
