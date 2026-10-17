import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { injectContext } from '@taiga-ui/polymorpheus';
import { TuiButton, type TuiDialogContext } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { CalendarNoteForm } from './calendar-note-form';
import { CalendarNoteDto } from '../../core/api/models/calendar-note.model';
import { CalendarNoteService } from '../../core/api/services/calendar-note.api';
import { resolveCalendarNoteError } from '../../core/api/calendar-note-errors';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ConfirmService, NotificationService } from '../../core/ui';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { isPointInTime, noteColor } from '../../shared/utils/calendar-notes';

/** Formato natural en español de España: `2 nov 2026`. */
function formatDay(date: Date): string {
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** `true` si la agenda debe recargarse (se editó o se eliminó). */
export type CalendarNoteDetailResult = boolean;

export interface CalendarNoteDetailData {
  note: CalendarNoteDto;
}

/**
 * Detalle de una nota, con edición en el sitio y borrado.
 *
 * El borrado es **físico** en backend, así que va siempre tras confirmación y
 * el texto dice que no hay vuelta atrás, en lugar de ofrecer un "deshacer" que
 * no podría devolver la misma entrada.
 */
@Component({
  selector: 'app-calendar-note-detail-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective, TuiButton, TuiBadge, CalendarNoteForm],
  template: `
    <div *transloco="let t" class="flex flex-col gap-4">
      @if (editing()) {
        <app-calendar-note-form
          [type]="note().type"
          [note]="note()"
          (saved)="onSaved()" />
      } @else {
        <div class="flex flex-col gap-3">
          <div class="flex flex-wrap items-center gap-2">
            <span
              class="inline-block size-2.5 rounded-[3px]"
              [style.background]="color()"
              aria-hidden="true"></span>
            <span tuiBadge appearance="neutral">
              {{ note().type === 'TIME_BLOCK' ? t('calendar_notes.type_time_block') : t('calendar_notes.type_reminder') }}
            </span>
            @if (note().allDay) {
              <span tuiBadge appearance="neutral">{{ t('calendar_notes.all_day_badge') }}</span>
            }
          </div>

          <p class="text-[13.5px] tabular-nums text-surface-600 dark:text-surface-300">
            <i class="fa-regular fa-clock mr-1.5" aria-hidden="true"></i>{{ when() }}
          </p>

          @if (note().description) {
            <p class="whitespace-pre-line text-sm text-surface-700 dark:text-surface-200">
              {{ note().description }}
            </p>
          }

          @if (note().reminderMinutesBefore) {
            <p class="text-[12.5px] text-surface-400">
              <i class="fa-regular fa-bell mr-1.5" aria-hidden="true"></i>
              {{ t('calendar_notes.reminder_set', { minutes: note().reminderMinutesBefore }) }}
            </p>
          }

          <p class="text-[12.5px] leading-snug text-surface-400">
            {{ note().type === 'TIME_BLOCK'
              ? t('calendar_notes.time_block_notice')
              : t('calendar_notes.reminder_no_block_notice') }}
          </p>

          @if (error()) {
            <p class="text-sm text-[color:var(--err)]" role="alert">{{ error() }}</p>
          }

          @if (canManage()) {
            <div class="flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button tuiButton type="button" appearance="primary" size="m" (click)="editing.set(true)">
                {{ t('common.edit') }}
              </button>
              <button
                tuiButton
                type="button"
                appearance="flat-destructive"
                size="m"
                [disabled]="deleting()"
                (click)="remove()">
                {{ t('common.delete') }}
              </button>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class CalendarNoteDetailDialog {
  private readonly noteService = inject(CalendarNoteService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly confirm = inject(ConfirmService);
  private readonly transloco = inject(TranslocoService);
  private readonly permissions = inject(PermissionsService);

  readonly context = injectContext<TuiDialogContext<CalendarNoteDetailResult, CalendarNoteDetailData>>();

  readonly editing = signal(false);
  readonly deleting = signal(false);
  readonly error = signal('');

  readonly canManage = computed(() => this.permissions.has('MANAGE_CALENDAR_NOTES'));

  note(): CalendarNoteDto {
    return this.context.data.note;
  }

  color(): string {
    return noteColor(this.note());
  }

  /**
   * Fecha legible de la entrada.
   *
   * Tres formas distintas, porque son tres cosas distintas: un recordatorio
   * puntual es un instante, un rango de "todo el día" son días completos (y
   * puede abarcar varios: unas vacaciones), y el resto es una franja horaria.
   */
  when(): string {
    const note = this.note();
    const start = new Date(note.startTime);
    const end = new Date(note.endTime);
    const startDate = formatDay(start);

    if (note.allDay) {
      // El fin es la medianoche del día siguiente, exclusiva: se retrocede un
      // milisegundo para no anunciar un día de más.
      const lastDay = new Date(end.getTime() - 1);
      return lastDay.toDateString() === start.toDateString()
        ? startDate
        : `${startDate} – ${formatDay(lastDay)}`;
    }

    if (isPointInTime(note)) return `${startDate}, ${formatHour(start)}`;

    return start.toDateString() === end.toDateString()
      ? `${startDate}, ${formatHour(start)} – ${formatHour(end)}`
      : `${startDate}, ${formatHour(start)} – ${formatDay(end)}, ${formatHour(end)}`;
  }

  onSaved(): void {
    this.context.completeWith(true);
  }

  remove(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.confirm
      .confirm({
        label: this.transloco.translate('calendar_notes.delete_confirm_title'),
        content: this.transloco.translate(
          this.note().type === 'TIME_BLOCK'
            ? 'calendar_notes.delete_confirm_block'
            : 'calendar_notes.delete_confirm'
        ),
        yes: this.transloco.translate('common.delete'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe(confirmed => {
        if (!confirmed) return;
        this.deleting.set(true);
        this.noteService.delete(tenantId, this.note().id).subscribe({
          next: () => {
            this.notify.success(
              this.transloco.translate('calendar_notes.delete_success'),
              this.transloco.translate('common.success')
            );
            this.context.completeWith(true);
          },
          error: err => {
            this.deleting.set(false);
            this.error.set(
              resolveCalendarNoteError(err, 'calendar_notes.delete_error', key => this.transloco.translate(key))
            );
          },
        });
      });
  }
}
