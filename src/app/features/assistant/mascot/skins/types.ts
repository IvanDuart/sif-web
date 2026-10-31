/**
 * Catálogo de skins procedurales de la mascota.
 *
 * Son datos planos a propósito (sin Angular): el servicio de estado los usa
 * para validar lo que encuentra en `localStorage`, y el registro de skins se
 * comprueba contra esta lista. Una skin listada aquí y ausente en el registro
 * es un error de test, no una mascota en blanco.
 */
export const SKIN_IDS = ['manzana', 'naranja', 'pina', 'melon'] as const;
export type SkinId = (typeof SKIN_IDS)[number];

/** La skin por defecto y a la que cae cualquier id desconocido. */
export const DEFAULT_SKIN: SkinId = 'manzana';

/** Lo que se puede poner encima de cualquier skin. */
export const ACCESSORY_IDS = ['orejas'] as const;
export type AccessoryId = (typeof ACCESSORY_IDS)[number];

export const isSkinId = (value: unknown): value is SkinId =>
  SKIN_IDS.includes(value as SkinId);

export const isAccessoryId = (value: unknown): value is AccessoryId =>
  ACCESSORY_IDS.includes(value as AccessoryId);

export interface Skin {
  id: SkinId;
}
