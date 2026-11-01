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
  /** Cuándo se eligió (ISO). Sirve para saber si manda esto o el look remoto. */
  updatedAt: string;
}

export const LOOK_KEY = 'sif-mascota';

const defaultLook = (): Look => ({ skin: DEFAULT_SKIN, accessories: [], updatedAt: EPOCH });

/**
 * Lo que vale una elección sin fecha: la de alguien que eligió antes de que se
 * guardara la fecha. Gana a lo remoto, porque fue un gesto deliberado y lo
 * remoto puede ser el look por defecto que nadie pidió.
 */
const UNDATED = '9999-12-31T00:00:00.000Z';
const EPOCH = '1970-01-01T00:00:00.000Z';

/** En el orden de `ACCESSORY_IDS`, una vez cada uno, y ninguno desconocido. */
export function cleanAccessories(value: unknown): AccessoryId[] {
  const asked = Array.isArray(value) ? value : [];
  return ACCESSORY_IDS.filter((id) => asked.includes(id) && isAccessoryId(id));
}

/** `null` cuando lo guardado no dice nada útil: no es la elección de nadie. */
function parseLook(raw: string): Look | null {
  if (!raw.trim().startsWith('{')) {
    return isSkinId(raw) ? { skin: raw, accessories: [], updatedAt: UNDATED } : null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    const { skin, accessories, updatedAt } = (parsed ?? {}) as {
      skin?: unknown;
      accessories?: unknown;
      updatedAt?: unknown;
    };
    return {
      skin: isSkinId(skin) ? skin : DEFAULT_SKIN,
      accessories: cleanAccessories(accessories),
      updatedAt: typeof updatedAt === 'string' && updatedAt ? updatedAt : UNDATED,
    };
  } catch {
    return null;
  }
}

export function writeLook(look: Look): void {
  try {
    window.localStorage.setItem(
      LOOK_KEY,
      JSON.stringify({ skin: look.skin, accessories: look.accessories, updatedAt: look.updatedAt })
    );
  } catch {
    // Almacenamiento bloqueado o lleno: dura hasta la próxima recarga.
  }
}

/**
 * El look que la persona eligió en este navegador, o `null` si nunca eligió.
 *
 * La diferencia importa: con `null` manda el `defaultSkinId` del centro, y con
 * un look guardado manda la persona, aunque coincida con el por defecto.
 */
export function readStoredLook(): Look | null {
  try {
    const raw = window.localStorage.getItem(LOOK_KEY);
    return raw === null ? null : parseLook(raw);
  } catch {
    return null;
  }
}

/** Lo que hay que empezar usando: lo guardado o el look por defecto. Nunca lanza. */
export function readLook(): Look {
  return readStoredLook() ?? defaultLook();
}
