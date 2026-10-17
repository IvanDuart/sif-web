/**
 * Notas personales de calendario del profesional (recordatorios y bloqueos).
 *
 * Son **privadas de su autor**: el backend resuelve el autor desde el JWT y
 * filtra siempre por él, así que ni un `ADMIN` ve las de otro profesional. Una
 * entrada ajena responde `404`, no `403`, para no revelar que existe.
 *
 * Ver `doc/calendario_notas_nutricionista_frontend.md`.
 */

/**
 * El tipo decide el comportamiento completo de la entrada:
 * - `REMINDER`: nota informativa, no afecta a las citas.
 * - `TIME_BLOCK`: franja no disponible, bloquea agendar y reagendar.
 */
export type CalendarNoteType = 'REMINDER' | 'TIME_BLOCK';

export interface CalendarNoteDto {
  id: string;
  tenantId: string;
  /** Autor. Lo asigna el backend desde el JWT; nunca se envía en un request. */
  readonly nutritionistId: string;
  type: CalendarNoteType;
  title: string;
  description: string | null;
  /** ISO 8601 en UTC. */
  startTime: string;
  /** ISO 8601 en UTC. Nunca es `null`: si no se envía al crear, se copia de `startTime`. */
  endTime: string;
  /** Marca de presentación: no cambia el cálculo de solapamientos. */
  allDay: boolean;
  /** Texto libre de 20 caracteres. El backend no lo valida ni lo interpreta. */
  color: string | null;
  reminderMinutesBefore: number | null;
  /** Derivado (`startTime - reminderMinutesBefore`). Solo lectura. */
  readonly remindAt: string | null;
  /** Cuándo se envió el push. Solo lectura, solo informativo. */
  readonly reminderSentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string | null;
}

export interface CreateCalendarNoteRequest {
  type: CalendarNoteType;
  /** Obligatorio, no vacío ni solo espacios, máx. 255. */
  title: string;
  description?: string | null;
  /**
   * ISO 8601. **Admite el pasado**, a diferencia de las citas: no reutilizar el
   * validador de fecha futura.
   */
  startTime: string;
  /** Si se omite se copia `startTime`. Obligatorio de facto en `TIME_BLOCK`. */
  endTime?: string | null;
  allDay?: boolean;
  /** Máx. 20 caracteres. Ver `CALENDAR_NOTE_PALETTE`. */
  color?: string | null;
  /** Debe ser `> 0`; omitir para no programar aviso. */
  reminderMinutesBefore?: number | null;
  /**
   * Permite crear un `TIME_BLOCK` que pisa una cita `SCHEDULED`. Es el mismo
   * flag que ya existe en las citas y cubre ambas comprobaciones.
   */
  allowOverlap?: boolean;
}

/**
 * Actualización **parcial**: todo campo ausente o `null` se deja como estaba.
 *
 * Por eso `reminderMinutesBefore: null` **no** quita el aviso; hay que enviar
 * `clearReminder: true` (si se envían ambos, gana `clearReminder`).
 */
export interface UpdateCalendarNoteRequest {
  type?: CalendarNoteType;
  title?: string;
  description?: string | null;
  startTime?: string;
  endTime?: string | null;
  allDay?: boolean;
  color?: string | null;
  reminderMinutesBefore?: number | null;
  /** Única forma de eliminar el aviso push. */
  clearReminder?: boolean;
  allowOverlap?: boolean;
}
