import type { FillSurface } from '../mascot/fill/descriptor';
import { matchArgs } from './fill-args';
import { allSurfaces } from './all-surfaces.testing';
import { fillTools } from './schema';

describe('matchArgs', () => {
  const surface: FillSurface = {
    id: 'schedule',
    tools: [],
    fields: [
      { key: 'name', kind: 'text', from: [] },
      { key: 'active', kind: 'boolean', from: [] },
    ],
    lists: [
      {
        key: 'details',
        add: '[data-add]',
        size: () => 0,
        max: 2,
        fields: [
          { key: 'day', kind: 'choice', from: [] },
          { key: 'startTime', kind: 'time', from: [] },
        ],
      },
    ],
  };

  it('las claves del esquema son las del formulario', () => {
    const { values, unknown } = matchArgs(surface, { name: 'Mañanas' });
    expect(values.map((value) => [value.field.key, value.raw])).toEqual([['name', 'Mañanas']]);
    expect(unknown).toEqual([]);
  });

  it('`false` es un valor, no un hueco', () => {
    const { values } = matchArgs(surface, { active: false });
    expect(values.map((value) => value.raw)).toEqual(['false']);
  });

  it('una clave nombrada y vacía no se escribe, y no es un error', () => {
    expect(matchArgs(surface, { name: '  ' }).values).toEqual([]);
    expect(matchArgs(surface, { name: '  ' }).unknown).toEqual([]);
  });

  it('lo que el modelo se inventa se le dice', () => {
    expect(matchArgs(surface, { peso: 70 }).unknown).toEqual(['peso']);
  });

  it('cada fila es una cadena con sus campos en orden, y crece la lista', () => {
    const { values } = matchArgs(surface, { details: ['Lunes | 09:00', 'Martes | 10:30'] });
    expect(values.map((value) => [value.field.key, value.raw, value.grow?.rows])).toEqual([
      ['details.0.day', 'Lunes', 1],
      ['details.0.startTime', '09:00', 1],
      ['details.1.day', 'Martes', 2],
      ['details.1.startTime', '10:30', 2],
    ]);
  });

  it('no se pasa del máximo de filas del formulario', () => {
    const { values } = matchArgs(surface, { details: ['a | 1', 'b | 2', 'c | 3'] });
    expect(values.every((value) => !value.field.key.startsWith('details.2'))).toBeTrue();
  });

  it('una fila que no es texto se ignora en vez de escribir «[object Object]»', () => {
    expect(matchArgs(surface, { details: [{ day: 'Lunes' }] }).values).toEqual([]);
  });

  it('todo lo que el esquema declara de las superficies reales se sabe volver a encontrar', () => {
    for (const real of allSurfaces()) {
      for (const tool of fillTools(real)) {
        const args = Object.fromEntries(
          tool.keys.map((key) => [key, real.lists?.some((list: { key: string }) => list.key === key) ? ['x'] : 'x']),
        );
        expect(matchArgs(real, args).unknown).withContext(`${real.id} · ${tool.decl.name}`).toEqual([]);
      }
    }
  });
});
