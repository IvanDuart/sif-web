import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';
import { TuiChip } from '@taiga-ui/kit';

import { CalendarNoteForm } from './calendar-note-form';
import { CalendarNoteType } from '../../core/api/models/calendar-note.model';

/** Qué se ha creado, para que la agenda sepa qué recargar. */
export type CreateEntryResult = 'APPOINTMENT' | 'NOTE';

export interface CreateEntryDialogData {
  /** Fecha y hora propuestas, si se abrió pulsando un hueco del calendario. */
  startTime?: Date;
}

type EntryKind = 'APPOINTMENT' | CalendarNoteType;

/**
 * Punto de entrada **único** para crear en la agenda.
 *
 * La guía de diseño (§5 y §8) pide un solo botón primario por pantalla y un
 * solo punto de entrada para crear, con las variantes —cita o bloqueo— como
 * selector dentro del propio diálogo, no como botones separados en la cabecera.
 *
 * El tipo es el primer campo porque condiciona todo lo demás. Las dos variantes
 * de nota se resuelven aquí mismo; la cita delega en `AppointmentFormDialog`,
 * que trae su propia agenda del día y su buscador de pacientes: en lugar de
 * duplicarlo, este diálogo se cierra devolviendo `'APPOINTMENT'` y la página lo
 * abre. Para el usuario sigue siendo un único recorrido desde un único botón.
 */
@Component({
  selector: 'app-create-entry-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, TuiChip, CalendarNoteForm],
  template: `
    <div *transloco="let t" class="flex flex-col gap-5">
      <fieldset class="flex flex-col gap-2">
        <legend class="mb-2 text-[12.5px] text-surface-500 dark:text-surface-400">
          {{ t('calendar_notes.entry_type_label') }}
        </legend>
        <div class="flex flex-wrap gap-2" role="group">
          @for (option of options; track option.kind) {
            <button
              tuiChip
              type="button"
              size="m"
              [appearance]="kind() === option.kind ? 'primary' : 'neutral'"
              [attr.aria-pressed]="kind() === option.kind"
              (click)="select(option.kind)">
              <i class="mr-1.5" [class]="option.icon" aria-hidden="true"></i>
              {{ t(option.labelKey) }}
            </button>
          }
        </div>
        <p class="text-[12.5px] leading-snug text-surface-400">
          {{ kind() ? t(hintKey()) : t('calendar_notes.entry_type_prompt') }}
        </p>
      </fieldset>

      @if (noteType(); as type) {
        <app-calendar-note-form
          [type]="type"
          [prefilledDate]="context.data.startTime ?? null"
          (saved)="context.completeWith('NOTE')" />
      }
    </div>
  `,
})
export class CreateEntryDialog {
  readonly context = injectContext<TuiDialogContext<CreateEntryResult, CreateEntryDialogData>>();

  /** Sin preselección: la primera decisión es del usuario, no del diálogo. */
  readonly kind = signal<EntryKind | null>(null);

  /** Solo las variantes de nota se resuelven dentro de este diálogo. */
  readonly noteType = computed<CalendarNoteType | null>(() => {
    const kind = this.kind();
    return kind === 'REMINDER' || kind === 'TIME_BLOCK' ? kind : null;
  });

  protected readonly options: readonly {
    readonly kind: EntryKind;
    readonly labelKey: string;
    readonly hintKey: string;
    readonly icon: string;
  }[] = [
    {
      kind: 'APPOINTMENT',
      labelKey: 'calendar_notes.entry_appointment',
      hintKey: 'calendar_notes.entry_appointment_hint',
      icon: 'fa-regular fa-calendar-check',
    },
    {
      kind: 'REMINDER',
      labelKey: 'calendar_notes.entry_reminder',
      hintKey: 'calendar_notes.entry_reminder_hint',
      icon: 'fa-regular fa-note-sticky',
    },
    {
      kind: 'TIME_BLOCK',
      labelKey: 'calendar_notes.entry_time_block',
      hintKey: 'calendar_notes.entry_time_block_hint',
      icon: 'fa-regular fa-calendar-xmark',
    },
  ];

  hintKey(): string {
    return this.options.find(o => o.kind === this.kind())?.hintKey ?? '';
  }

  /**
   * Elegir "Cita" cierra el diálogo inmediatamente: la página abre el
   * formulario de cita conservando la fecha pulsada.
   */
  select(kind: EntryKind): void {
    if (kind === 'APPOINTMENT') {
      this.context.completeWith('APPOINTMENT');
      return;
    }
    this.kind.set(kind);
  }
}
