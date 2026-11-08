import { HttpHeaders } from '@angular/common/http';

/**
 * Cabecera de idempotencia de los POST críticos del backend.
 *
 * El backend acepta `Idempotency-Key: <UUID>` en los POST de citas, menús,
 * comidas, mediciones y generación de lista de la compra. Si el cliente
 * reintenta con la misma clave recibe el resultado original (y
 * `X-Cache-Lookup: HIT`); dos peticiones concurrentes con la misma clave
 * chocan con `409 Conflict`.
 *
 * Para que un reintento aproveche la caché hay que **reutilizar** la clave: se
 * genera una al abrir el formulario y se pasa a cada reintento, no una nueva
 * por intento.
 */
export const IDEMPOTENCY_KEY_HEADER = 'Idempotency-Key';

/**
 * Cabeceras de un POST crítico. Si no se pasa clave se genera una nueva: así la
 * petición siempre viaja protegida y, cuando el llamador reutiliza la clave en
 * un reintento, el backend devuelve el resultado original.
 */
export function idempotencyHeaders(key?: string | null): HttpHeaders {
  return new HttpHeaders({ [IDEMPOTENCY_KEY_HEADER]: key ?? newIdempotencyKey() });
}

/** UUID v4 para `Idempotency-Key`, con respaldo si `crypto.randomUUID` no existe. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Respaldo RFC 4122 v4 para navegadores antiguos o contextos no seguros.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
