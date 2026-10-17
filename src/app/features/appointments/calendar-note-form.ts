import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton, TuiDropdown, TuiLabel, TuiTextfield, TuiInput } from '@taiga-ui/core';
import { TuiChip, TuiInputDate, TuiInputTime, TuiSwitch, TuiTextarea } from '@taiga-ui/kit';
import { TuiDay, TuiTime } from '@taiga-ui/cdk';

import { CalendarNoteService } from '../../core/api/services/calendar-note.api';
import {
  CalendarNoteDto,
  CalendarNoteType,
  CreateCalendarNoteRequest,
  UpdateCalendarNoteRequest,
} from '../../core/api/models/calendar-note.model';
import {
  isNoteOverlapsAppointment,
  resolveCalendarNoteError,
} from '../../core/api/calendar-note-errors';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ConfirmService, NotificationService } from '../../core/ui';
import { CALENDAR_NOTE_PALETTE, allDayRange } from '../../shared/utils/calendar-notes';

/**
 * Opciones de aviso push.
 *
 * Se ofrecen como lista cerrada en lugar de un entero libre porque el backend
 * rechaza con `400` cualquier valor `<= 0` y el job solo corre cada 5 minutos:
 * un "7 minutos antes" sería una precisión que el sistema no puede cumplir.
 */
const REMINDER_OPTIONS: readonly { readonly minutes: number | null; readonly labelKey: string }[] = [
  { minutes: null, labelKey: 'calendar_notes.reminder_none' },
  { minutes: 10, labelKey: 'calendar_notes.reminder_10' },
  { minutes: 30, labelKey: 'calendar_notes.reminder_30' },
  { minutes: 60, labelKey: 'calendar_notes.reminder_60' },
  { minutes: 1440, labelKey: 'calendar_notes.reminder_1440' },
];

const MAX_TITLE = 255;

/**
 * Alta y edición de una nota de calendario.
 *
 * Es un componente normal, no un diálogo: lo incrusta `CreateEntryDialog` al
 * crear y `CalendarNoteDetailDialog` al editar, igual que `QuickScheduleWidget`
 * se reutiliza dentro y fuera de su diálogo.
 */
@Component({
  selector: 'app-calendar-note-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    TranslocoDirective,
    TuiButton,
    TuiChip,
    TuiDropdown,
    TuiInput,
    TuiInputDate,
    TuiInputTime,
    TuiLabel,
    TuiSwitch,
    TuiTextarea,
    TuiTextfield,
  ],
  templateUrl: './calendar-note-form.html',
})
export class CalendarNoteForm {
  private readonly noteService = inject(CalendarNoteService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);

  /** Tipo de la entrada. Lo fija el selector del diálogo que la incrusta. */
  readonly type = input.required<CalendarNoteType>();
  /** Entrada existente al editar; `null` al crear. */
  readonly note = input<CalendarNoteDto | null>(null);
  /** Fecha y hora propuestas al crear desde un hueco del calendario. */
  readonly prefilledDate = input<Date | null>(null);

  readonly saved = output<CalendarNoteDto>();

  readonly saving = signal(false);
  readonly error = signal('');

  readonly title = signal('');
  readonly description = signal('');
  readonly allDay = signal(false);
  readonly day = signal<TuiDay>(TuiDay.currentLocal());
  readonly startTime = signal<TuiTime>(new TuiTime(9, 0));
  readonly endTime = signal<TuiTime>(new TuiTime(10, 0));
  readonly reminderMinutes = signal<number | null>(null);
  readonly color = signal<string>(CALENDAR_NOTE_PALETTE[0].hex);

  protected readonly palette = CALENDAR_NOTE_PALETTE;
  protected readonly reminderOptions = REMINDER_OPTIONS;
  protected readonly maxTitle = MAX_TITLE;

  readonly isEdit = computed(() => !!this.note());
  readonly isTimeBlock = computed(() => this.type() === 'TIME_BLOCK');

  /**
   * Motivo por el que no se puede guardar, o cadena vacía.
   *
   * Se muestra en el pie junto al primario (§7 de la guía: el diálogo explica
   * por qué está deshabilitado en lugar de dejarlo adivinar).
   */
  readonly blockingReason = computed(() => {
    if (!this.title().trim()) return this.transloco.translate('calendar_notes.needs_title');
    if (this.allDay()) return '';
    // Un recordatorio puntual (inicio == fin) es válido; un bloqueo de duración
    // cero lo rechaza el backend con un `400` seco, así que se corta antes.
    if (this.isTimeBlock() && this.minutesOf(this.endTime()) <= this.minutesOf(this.startTime())) {
      return this.transloco.translate('calendar_notes.needs_end_after_start');
    }
    if (!this.isTimeBlock() && this.minutesOf(this.endTime()) < this.minutesOf(this.startTime())) {
      return this.transloco.translate('calendar_notes.needs_end_after_start');
    }
    return '';
  });

  readonly canSave = computed(() => !this.blockingReason() && !this.saving());

  constructor() {
    // Primera carga: entrada existente, hueco pulsado en el calendario, o los
    // valores por defecto. Depende de inputs, así que vive en un effect.
    effect(() => {
      const existing = this.note();
      if (existing) {
        this.hydrateFrom(existing);
        return;
      }
      const prefilled = this.prefilledDate();
      if (prefilled) this.hydrateFromDate(prefilled);
    });
  }

  private hydrateFrom(note: CalendarNoteDto): void {
    const start = new Date(note.startTime);
    const end = new Date(note.endTime);
    this.title.set(note.title);
    this.description.set(note.description ?? '');
    this.allDay.set(note.allDay);
    this.day.set(TuiDay.fromLocalNativeDate(start));
    this.startTime.set(new TuiTime(start.getHours(), start.getMinutes()));
    this.endTime.set(new TuiTime(end.getHours(), end.getMinutes()));
    this.reminderMinutes.set(note.reminderMinutesBefore);
    const known = CALENDAR_NOTE_PALETTE.find(c => c.hex.toLowerCase() === note.color?.trim().toLowerCase());
    this.color.set(known?.hex ?? CALENDAR_NOTE_PALETTE[0].hex);
  }

  private hydrateFromDate(date: Date): void {
    this.day.set(TuiDay.fromLocalNativeDate(date));
    const hours = date.getHours();
    const minutes = date.getMinutes();
    this.startTime.set(new TuiTime(hours, minutes));
    this.endTime.set(new TuiTime(Math.min(hours + 1, 23), minutes));
  }

  private minutesOf(time: TuiTime): number {
    return time.hours * 60 + time.minutes;
  }

  selectColor(hex: string): void {
    this.color.set(hex);
  }

  selectReminder(minutes: number | null): void {
    this.reminderMinutes.set(minutes);
  }

  submit(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canSave()) return;

    const { startTime, endTime } = this.resolveRange();
    const existing = this.note();

    if (existing) {
      this.executeUpdate(tenantId, existing.id, {
        type: this.type(),
        title: this.title().trim(),
        description: this.description().trim() || null,
        startTime,
        endTime,
        allDay: this.allDay(),
        color: this.color(),
        // `null` significa "no tocar", así que quitar el aviso exige el flag.
        reminderMinutesBefore: this.reminderMinutes() ?? undefined,
        clearReminder: this.reminderMinutes() === null,
      });
      return;
    }

    this.executeCreate(tenantId, {
      type: this.type(),
      title: this.title().trim(),
      description: this.description().trim() || null,
      startTime,
      endTime,
      allDay: this.allDay(),
      color: this.color(),
      reminderMinutesBefore: this.reminderMinutes() ?? undefined,
    });
  }

  /**
   * Convierte los controles locales a UTC.
   *
   * En "todo el día" el rango se calcula desde la medianoche **local**: el
   * backend no normaliza zonas, así que enviar `00:00Z–23:59Z` desplazaría el
   * bloqueo una o dos horas y bloquearía franjas equivocadas.
   */
  private resolveRange(): { startTime: string; endTime: string } {
    const nativeDay = this.day().toLocalNativeDate();
    if (this.allDay()) return allDayRange(nativeDay);

    const start = new Date(nativeDay);
    start.setHours(this.startTime().hours, this.startTime().minutes, 0, 0);
    const end = new Date(nativeDay);
    end.setHours(this.endTime().hours, this.endTime().minutes, 0, 0);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
  }

  /**
   * Crea la entrada. Si el bloqueo pisa una cita ya agendada el backend
   * responde `409`; se ofrece forzarlo con `allowOverlap`, nunca en silencio.
   */
  private executeCreate(tenantId: string, request: CreateCalendarNoteRequest, allowOverlap = false): void {
    this.saving.set(true);
    this.error.set('');

    const payload = allowOverlap ? { ...request, allowOverlap: true } : request;

    this.noteService.create(tenantId, payload).subscribe({
      next: note => {
        this.notify.success(
          this.transloco.translate('calendar_notes.create_success'),
          this.transloco.translate('common.success')
        );
        this.saving.set(false);
        this.saved.emit(note);
      },
      error: err => {
        this.saving.set(false);
        if (allowOverlap || !isNoteOverlapsAppointment(err)) {
          this.error.set(this.resolveError(err, 'calendar_notes.create_error'));
          return;
        }
        this.confirmOverlap(() => this.executeCreate(tenantId, request, true), err, 'calendar_notes.create_error');
      },
    });
  }

  private executeUpdate(
    tenantId: string,
    noteId: string,
    request: UpdateCalendarNoteRequest,
    allowOverlap = false
  ): void {
    this.saving.set(true);
    this.error.set('');

    const payload = allowOverlap ? { ...request, allowOverlap: true } : request;

    this.noteService.update(tenantId, noteId, payload).subscribe({
      next: note => {
        this.notify.success(
          this.transloco.translate('calendar_notes.update_success'),
          this.transloco.translate('common.success')
        );
        this.saving.set(false);
        this.saved.emit(note);
      },
      error: err => {
        this.saving.set(false);
        if (allowOverlap || !isNoteOverlapsAppointment(err)) {
          this.error.set(this.resolveError(err, 'calendar_notes.update_error'));
          return;
        }
        this.confirmOverlap(
          () => this.executeUpdate(tenantId, noteId, request, true),
          err,
          'calendar_notes.update_error'
        );
      },
    });
  }

  private confirmOverlap(retry: () => void, err: unknown, fallbackKey: string): void {
    this.confirm
      .confirm({
        label: this.transloco.translate('calendar_notes.overlap_confirm_title'),
        content: this.transloco.translate('calendar_notes.overlap_confirm'),
        yes: this.transloco.translate('calendar_notes.overlap_confirm_yes'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe(confirmed => {
        if (confirmed) retry();
        else this.error.set(this.resolveError(err, fallbackKey));
      });
  }

  private resolveError(err: unknown, fallbackKey: string): string {
    return resolveCalendarNoteError(err as { status?: number; error?: unknown }, fallbackKey, key =>
      this.transloco.translate(key)
    );
  }
}
