import { slugOf } from '../../../copilot/tool-names';
import type { FieldAccess, FillField, FillOpener, FillSurface } from '../descriptor';
import { toNumber } from './measurement.surface';

/** Un grupo de intercambio tal y como lo enseña el editor. */
export interface ExchangeGroupRow {
  id: string;
  name: string;
}

/**
 * La clave de cada grupo: su nombre en minúsculas y sin acentos («Farináceos» →
 * `farinaceos`). Es lo que ve el modelo como nombre del campo, así que tiene
 * que leerse; el id del grupo no dice nada. Si dos grupos dan la misma clave,
 * el segundo lleva el número detrás para que ninguno pise al otro.
 */
export function exchangeKeys(groups: readonly ExchangeGroupRow[]): Map<string, string> {
  const keys = new Map<string, string>();
  const used = new Set<string>();
  for (const group of groups) {
    const base = slugOf(group.name.normalize('NFD').replace(/[̀-ͯ]/g, '')) || 'grupo';
    let key = base;
    for (let n = 2; used.has(key); n += 1) key = `${base}_${n}`;
    used.add(key);
    keys.set(group.id, key);
  }
  return keys;
}

/**
 * Las raciones de intercambio de UNA comida (`menus/components/meal-exchanges-editor`).
 *
 * Los campos salen de los grupos del centro, que se cargan por HTTP, así que se
 * leen cada vez (`fields` es un getter) y el formulario no está listo hasta que
 * llegan. Un campo por grupo, de número: las raciones objetivo. Lo que se deja
 * vacío o a cero no se guarda, igual que si lo hiciera la persona.
 *
 * Cubre `update_meal_exchanges`. Su `syncItems` no tiene campo: el botón del
 * editor siempre reescribe los gramos de los ingredientes, que es lo que el
 * backend hace por defecto.
 */
export function mealExchangesSurface(options: {
  groups(): readonly ExchangeGroupRow[];
  ready(): boolean;
  /** La comida cuyas raciones están cargadas. */
  mealId(): string | null;
}): FillSurface {
  return {
    id: 'meal-exchanges',
    tools: ['update_meal_exchanges'],
    ready: options.ready,
    subject: options.mealId,
    get fields(): readonly FillField[] {
      const groups = options.groups();
      const keys = exchangeKeys(groups);
      return groups.map((group) => ({
        key: keys.get(group.id) as string,
        kind: 'number' as const,
        // El backend nombra el grupo por su id; el modelo, por su nombre.
        from: [group.id, group.name],
        hint: `Raciones de ${group.name}`,
        parse: toNumber,
      }));
    },
  };
}

/**
 * `FieldAccess` sobre las filas del editor, que van por `ngModel` y no por un
 * formulario reactivo: se lee y se escribe la fila del grupo por su clave.
 */
export function exchangesAccess(options: {
  groups(): readonly ExchangeGroupRow[];
  get(groupId: string): number | null;
  set(groupId: string, value: number | null): void;
}): FieldAccess {
  const groupOf = (key: string): string | null => {
    for (const [id, groupKey] of exchangeKeys(options.groups())) if (groupKey === key) return id;
    return null;
  };
  return {
    get: (key) => {
      const id = groupOf(key);
      return id ? options.get(id) : undefined;
    },
    set: (key, value) => {
      const id = groupOf(key);
      if (!id) return;
      const number = typeof value === 'number' ? value : value === null || value === '' ? null : Number(value);
      options.set(id, number === null || Number.isFinite(number) ? number : null);
    },
  };
}

/**
 * Cómo se abren las raciones de una comida: pulsando la comida en la rejilla
 * del menú, que en modo BEDCA la despliega con sus ingredientes y, debajo, las
 * raciones. Hay una por casilla, así que hay que decir cuál (`mealId`).
 *
 * Sólo existe si el centro trabaja con intercambios y en modo BEDCA
 * (`requires`): en modo manual, pulsar la comida edita su texto y no despliega
 * nada.
 */
export const MEAL_EXCHANGES_OPENER: FillOpener = {
  id: 'meal-exchanges',
  tools: ['update_meal_exchanges'],
  screen: 'MENU',
  trigger: '[data-mascot-meal="{mealId}"]',
  param: { name: 'mealId', description: 'Id de la comida cuyas raciones se abren' },
  requires: 'exchanges',
};
