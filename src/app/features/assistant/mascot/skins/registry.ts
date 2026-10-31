import { DEFAULT_SKIN, SKIN_IDS, isSkinId, type Skin } from './types';

/**
 * Todas las skins, en el orden en que las muestra el wardrobe. Añadir una es
 * su id en `types.ts`, su dibujo en `outlines.ts` y sus ojos en `faces.ts`:
 * aquí no hay nada que tocar.
 */
export const SKINS: readonly Skin[] = SKIN_IDS.map((id) => ({ id }));

export function getSkin(id: unknown): Skin {
  return SKINS.find((entry) => entry.id === id) ?? SKINS.find((entry) => entry.id === DEFAULT_SKIN)!;
}

export { DEFAULT_SKIN, isSkinId };

