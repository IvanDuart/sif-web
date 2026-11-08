import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

/**
 * Control de concurrencia optimista de menús y comidas (ETag / `If-Match`).
 *
 * - `GET /menu/{id}` y `GET /meal/{id}` publican `ETag: "<version>"`.
 * - `PUT`/`PATCH` exigen `If-Match: "<version>"`: sin ella el backend responde
 *   `428 Precondition Required` y, si la versión ya no coincide, `409 Conflict`.
 * - Una escritura correcta devuelve el nuevo `ETag`.
 */
export interface Versioned<T> {
  data: T;
  /** Valor literal de la cabecera `ETag`, comillas incluidas. */
  etag: string | null;
}

/** `If-Match: *` aceptado por el backend como «cualquier versión». */
export const ANY_VERSION = '*';

export const ETAG_CONFLICT_STATUS = 409;
export const ETAG_PRECONDITION_REQUIRED_STATUS = 428;

/** Extrae el `ETag` de una respuesta (o `null` si el proxy no lo dejó pasar). */
export function etagOf(headers: HttpHeaders | null | undefined): string | null {
  const value = headers?.get('ETag') ?? headers?.get('etag');
  return value && value.trim().length > 0 ? value.trim() : null;
}

/** Cabeceras de escritura: siempre manda `If-Match`, con `*` si no hay versión. */
export function ifMatchHeaders(etag: string | null): HttpHeaders {
  return new HttpHeaders({ 'If-Match': etag ?? ANY_VERSION });
}

/** `409`: otro usuario guardó antes; hay que recargar antes de reintentar. */
export function isVersionConflict(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === ETAG_CONFLICT_STATUS;
}

/** `428`: la petición salió sin `If-Match` (versión no disponible en cliente). */
export function isPreconditionRequired(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === ETAG_PRECONDITION_REQUIRED_STATUS;
}

/** Cualquiera de los dos fallos de concurrencia que la UI debe resolver. */
export function isEtagFailure(error: unknown): boolean {
  return isVersionConflict(error) || isPreconditionRequired(error);
}
