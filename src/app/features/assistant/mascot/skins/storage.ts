import {
  ACCESSORY_IDS,
  DEFAULT_SKIN,
  isAccessoryId,
  isSkinId,
  type AccessoryId,
  type SkinId,
} from './types';

/** Lo que la persona eligió; lo único que la mascota recuerda (solo este navegador). */
export interface Look {
  skin: SkinId;
  accessories: AccessoryId[];
}

export const LOOK_KEY = 'sif-mascota';

const defaultLook = (): Look => ({ skin: DEFAULT_SKIN, accessories: [] });

/** En el orden de `ACCESSORY_IDS`, una vez cada uno, y ninguno desconocido. */
export function cleanAccessories(value: unknown): AccessoryId[] {
  const asked = Array.isArray(value) ? value : [];
  return ACCESSORY_IDS.filter((id) => asked.includes(id) && isAccessoryId(id));
}

function parseLook(raw: string): Look {
  if (!raw.trim().startsWith('{')) return { skin: isSkinId(raw) ? raw : DEFAULT_SKIN, accessories: [] };
  try {
    const parsed: unknown = JSON.parse(raw);
    const { skin, accessories } = (parsed ?? {}) as { skin?: unknown; accessories?: unknown };
    return { skin: isSkinId(skin) ? skin : DEFAULT_SKIN, accessories: cleanAccessories(accessories) };
  } catch {
    return defaultLook();
  }
}

export function writeLook(look: Look): void {
  try {
    window.localStorage.setItem(LOOK_KEY, JSON.stringify({ skin: look.skin, accessories: look.accessories }));
  } catch {
    // Almacenamiento bloqueado o lleno: dura hasta la próxima recarga.
  }
}

/** Lo que hay que empezar usando: lo guardado o el look por defecto. Nunca lanza. */
export function readLook(): Look {
  try {
    const raw = window.localStorage.getItem(LOOK_KEY);
    if (raw !== null) return parseLook(raw);
    return defaultLook();
  } catch {
    return defaultLook();
  }
}
