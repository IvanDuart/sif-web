import { ApiErrorLike } from './appointment-errors';

/**
 * El backend devuelve el mensaje **ya traducido** según `Accept-Language`, no
 * una clave estable, así que hacer matching por texto es frágil. En los
 * endpoints de notas el discriminante fiable es el par código HTTP + endpoint:
 * un `409` aquí solo puede significar una cosa.
 *
 * Ver §6 de `doc/calendario_notas_nutricionista_frontend.md`.
 */

/**
 * `409` al crear o editar un `TIME_BLOCK` que pisa una cita `SCHEDULED`.
 * Es el único conflicto posible en este endpoint y es forzable con
 * `allowOverlap: true`.
 */
export function isNoteOverlapsAppointment(err: ApiErrorLike | null | undefined): boolean {
  return err?.status === 409;
}

/**
 * `404` significa «no existe **o es de otro profesional**»: el backend oculta
 * la diferencia a propósito. Para el usuario el efecto es el mismo (su lista
 * está desactualizada), así que se trata como un único caso.
 */
export function isNoteGone(err: ApiErrorLike | null | undefined): boolean {
  return err?.status === 404;
}

/**
 * Resuelve el texto a mostrar.
 *
 * Los `400` de validación de formato los gestiona Spring, no el manejador del
 * proyecto, así que **no** llegan con la forma `{ error: ... }`: se discriminan
 * solo por el código. El resto de errores de negocio sí traen mensaje legible y
 * se muestra tal cual para no enmascararlo con un genérico.
 */
export function resolveCalendarNoteError(
  err: ApiErrorLike | null | undefined,
  fallbackKey: string,
  translate: (key: string) => string
): string {
  if (err?.status === 400) return translate('calendar_notes.error_invalid_range');
  if (isNoteGone(err)) return translate('calendar_notes.error_not_found');
  if (err?.status === 403) return translate('calendar_notes.error_forbidden');

  const body = err?.error;
  const message =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? ((body as { error: string }).error).trim()
      : '';
  return message || translate(fallbackKey);
}
