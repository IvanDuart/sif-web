import { BASE_VARS } from './baseVars';
import {
  DEFAULT_SKIN,
  SKIN_IDS,
  isSkinId,
  type Skin,
  type SkinId,
  type SkinVars,
} from './types';

const skin = (id: SkinId, overrides: Partial<SkinVars> = {}): Skin => ({
  id,
  vars: { ...BASE_VARS, ...overrides },
});

/** Dónde van las orejas y la coronilla de cada skin (su cara está en `faces.ts`). */
const ENTRIES: readonly Skin[] = [
  skin('manzana', {
    '--m-ear-a': '#d84a3f',
    '--m-ear-b': '#b23b32',
    '--m-crown': '-2px',
  }),
  skin('naranja', {
    '--m-ear-a': '#f3901f',
    '--m-ear-b': '#d9701a',
    '--m-ear-top': '-7px',
    '--m-crown': '-4px',
  }),
  skin('pina', {
    '--m-ear-a': '#edb63a',
    '--m-ear-b': '#c8921c',
    '--m-ear-top': '-5px',
    '--m-crown': '-1px',
  }),
  skin('melon', {
    '--m-ear-a': '#9bc45f',
    '--m-ear-b': '#6f9a3a',
    '--m-ear-top': '-7px',
    '--m-crown': '-3px',
  }),
];

/**
 * Todas las skins, en el orden en que las muestra el wardrobe. Añadir una es
 * un dibujo en `outlines.ts`, sus ojos en `faces.ts`, una entrada aquí y su id
 * en `types.ts`.
 */
export const SKINS: readonly Skin[] = SKIN_IDS.map((id) => {
  const found = ENTRIES.find((entry) => entry.id === id);
  if (!found) throw new Error(`Mascot skin "${id}" is listed in SKIN_IDS and has no entry in the registry`);
  return found;
});

export function getSkin(id: unknown): Skin {
  return SKINS.find((entry) => entry.id === id) ?? SKINS.find((entry) => entry.id === DEFAULT_SKIN)!;
}

export { DEFAULT_SKIN, isSkinId };

/** Los números de la skin como estilo de lo que la dibuja. */
export const skinVars = (id: SkinId): SkinVars => getSkin(id).vars;
