import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { FullCalendarComponent, FullCalendarModule } from '@fullcalendar/angular';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { DateClickArg } from '@fullcalendar/interaction';
import esLocale from '@fullcalendar/core/locales/es';
import type {
  CalendarOptions,
  DatesSetArg,
  EventClickArg,
  EventSourceInput,
} from '@fullcalendar/core';
import { SkeletonComponent } from 'boneyard-js/angular';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { AppointmentService } from '../../core/api/services/appointment.api';
import {
  AppointmentDto,
  AppointmentStatus,
  UpdateAppointmentStatusRequest,
} from '../../core/api/models/appointment.model';
import { AppointmentFormDialog } from './appointment-form.dialog';
import { AppointmentActionDialog } from './appointment-action.dialog';
import { CreateEntryDialog, CreateEntryDialogData, CreateEntryResult } from './create-entry.dialog';
import { CalendarNoteDetailDialog, CalendarNoteDetailData } from './calendar-note-detail.dialog';
import { CalendarNoteService } from '../../core/api/services/calendar-note.api';
import { CalendarNoteDto } from '../../core/api/models/calendar-note.model';
import { clipToRange, isPointInTime, noteColor } from '../../shared/utils/calendar-notes';
import { PermissionsService } from '../../core/permissions/permissions.service';
import { isPastInstant } from '../../shared/utils/date';
import {
  ACTIVE_HOURS_COLOR,
  CLOSED_COLOR,
  HOLIDAY_COLOR,
  statusColor,
} from '../../shared/utils/status-colors';
import { hexToRgba } from '../../shared/utils/chart-config';
import { ModalService, NotificationService } from '../../core/ui';
import { TuiButton } from '@taiga-ui/core';
import { TuiChip, TuiSegmented } from '@taiga-ui/kit';
import { ScheduleAvailabilityService } from '../../core/api/services/schedule-availability.service';

/** Vistas soportadas, en el orden del conmutador Día/Semana/Mes. */
type AgendaViewType = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';

const VIEW_ORDER: readonly AgendaViewType[] = ['timeGridDay', 'timeGridWeek', 'dayGridMonth'];

/** La vista elegida se recuerda mientras dure la pestaña (requisito de rediseño). */
const VIEW_STORAGE_KEY = 'appointments:view';

/** Clase CSS por estado para que la agenda distinga la cita propuesta, etc. */
const STATUS_CLASS: Partial<Record<AppointmentStatus, string>> = {
  PROPOSED: 'fc-event--proposed',
  CANCELLED: 'fc-event--cancelled',
  COMPLETED: 'fc-event--completed',
  NO_SHOW: 'fc-event--no-show',
};

/**
 * Vista previa/actual con el viewport del momento, o la última elegida por el
 * usuario en esta pestaña. En móvil la semana es inusable, así que se fuerza el
 * día aunque la preferencia guardada sea otra.
 */
function resolveInitialView(): AgendaViewType {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const stored =
    typeof sessionStorage === 'undefined'
      ? null
      : (sessionStorage.getItem(VIEW_STORAGE_KEY) as AgendaViewType | null);

  if (stored && VIEW_ORDER.includes(stored)) {
    return isMobile ? 'timeGridDay' : stored;
  }
  return isMobile ? 'timeGridDay' : 'timeGridWeek';
}

function persistView(view: AgendaViewType): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(VIEW_STORAGE_KEY, view);
  }
}

/**
 * Capas superpuestas de la agenda.
 *
 * Una cita y un bloqueo a la misma hora compiten por el mismo espacio —es
 * justo el caso que el bloqueo describe—, así que se puede apagar cada capa
 * para mirar una sola cosa. Es un filtro de visualización: no cambia nada del
 * dato ni de lo que el backend valida al agendar.
 */
interface AgendaLayers {
  appointments: boolean;
  reminders: boolean;
  blocks: boolean;
}

const ALL_LAYERS_VISIBLE: AgendaLayers = { appointments: true, reminders: true, blocks: true };

/** Igual que la vista, la elección dura lo que dure la pestaña. */
const LAYERS_STORAGE_KEY = 'appointments:layers';

function resolveInitialLayers(): AgendaLayers {
  if (typeof sessionStorage === 'undefined') return { ...ALL_LAYERS_VISIBLE };
  try {
    const stored = sessionStorage.getItem(LAYERS_STORAGE_KEY);
    if (!stored) return { ...ALL_LAYERS_VISIBLE };
    const parsed = JSON.parse(stored) as Partial<AgendaLayers>;
    return {
      appointments: parsed.appointments !== false,
      reminders: parsed.reminders !== false,
      blocks: parsed.blocks !== false,
    };
  } catch {
    // Un valor corrupto no puede dejar la agenda en blanco.
    return { ...ALL_LAYERS_VISIBLE };
  }
}

function persistLayers(layers: AgendaLayers): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers));
  }
}

@Component({
  selector: 'app-appointments-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FullCalendarModule,
    TranslocoDirective,
    SkeletonComponent,
    TuiButton,
    TuiChip,
    TuiSegmented,
  ],
  templateUrl: './appointments.page.html',
})
export default class AppointmentsPage implements OnInit, OnDestroy {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly appointmentService = inject(AppointmentService);
  private readonly modal = inject(ModalService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly scheduleAvailability = inject(ScheduleAvailabilityService);
  private readonly calendarNoteService = inject(CalendarNoteService);
  private readonly permissions = inject(PermissionsService);

  @ViewChild('calendar') calendarComponent?: FullCalendarComponent;

  canViewAppointments = computed(() => this.tenantCtx.hasPermission('VIEW_APPOINTMENTS'));
  currentUserId = computed(() => this.authService.user()?.id || '');

  /**
   * Las notas de calendario son privadas de su autor y esta agenda siempre
   * muestra la del usuario conectado, así que basta con el permiso: no existe
   * forma de ver —ni de pedir— el calendario personal de otro profesional.
   */
  canViewNotes = computed(() => this.permissions.has('VIEW_CALENDAR_NOTES'));
  canManageNotes = computed(() => this.permissions.has('MANAGE_CALENDAR_NOTES'));

  todayAppointments = signal<AppointmentDto[]>([]);
  weekAppointments = signal<AppointmentDto[]>([]);
  weekNotes = signal<CalendarNoteDto[]>([]);

  // ── Capas visibles ─────────────────────────────────────────────────────

  layers = signal<AgendaLayers>(resolveInitialLayers());

  /**
   * Cuántos elementos tiene cada capa en el rango visible.
   *
   * Van en el propio filtro para que apagar una capa no la haga desaparecer
   * del todo: el contador sigue diciendo qué hay escondido.
   */
  layerCounts = computed(() => {
    const notes = this.weekNotes();
    return {
      appointments: this.weekAppointments().length,
      reminders: notes.filter(n => n.type === 'REMINDER').length,
      blocks: notes.filter(n => n.type === 'TIME_BLOCK').length,
    };
  });

  /** Con todo apagado el calendario queda vacío sin explicar por qué. */
  allLayersHidden = computed(() => {
    const { appointments, reminders, blocks } = this.layers();
    return !appointments && (!this.canViewNotes() || (!reminders && !blocks));
  });

  toggleLayer(layer: keyof AgendaLayers) {
    const next = { ...this.layers(), [layer]: !this.layers()[layer] };
    this.layers.set(next);
    persistLayers(next);
    this.buildCalendarEvents();
  }

  showAllLayers() {
    this.layers.set({ ...ALL_LAYERS_VISIBLE });
    persistLayers(ALL_LAYERS_VISIBLE);
    this.buildCalendarEvents();
  }
  loadingToday = signal(false);
  loadingWeek = signal(false);
  updatingStatus = signal<string | null>(null);
  todayScheduleText = signal('');

  /** Etiqueta del periodo visible ("21 – 26 de septiembre de 2026"). */
  rangeLabel = signal('');

  /** Vista recordada en la pestaña (o la que corresponde al viewport). */
  private readonly initialViewType = resolveInitialView();
  viewIndex = signal(VIEW_ORDER.indexOf(this.initialViewType));
  private readonly currentView = signal<AgendaViewType>(this.initialViewType);

  todayStart = '';
  todayEnd = '';
  weekStart = '';
  weekEnd = '';

  protected readonly isPastInstant = isPastInstant;
  protected readonly statusColor = statusColor;
  protected readonly holidayColor = HOLIDAY_COLOR;
  protected readonly closedColor = CLOSED_COLOR;
  protected readonly activeHoursDot = hexToRgba(ACTIVE_HOURS_COLOR, 0.6);

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: this.initialViewType,
    // Los controles son propios (stepper + conmutador de vista), así que la
    // barra nativa de FullCalendar se oculta.
    headerToolbar: false,
    locales: [esLocale],
    locale: 'es',
    // La banda superior es donde van las entradas de "todo el día" (una
    // ausencia, unas vacaciones). Las citas siempre tienen hora, así que la
    // banda solo aparece poblada cuando hay notas que lo justifiquen.
    allDaySlot: true,
    // Overlapping appointments render as side-by-side columns so staff can spot
    // the intentional clash (the backend now allows it for nutritionists).
    slotEventOverlap: false,
    slotMinTime: '06:00:00',
    slotMaxTime: '22:00:00',
    height: 'auto',
    firstDay: 1,
    editable: false,
    selectable: false,
    dayMaxEvents: 4,
    dateClick: (info: DateClickArg) => {
      this.handleDateClick(info);
    },
    eventClick: (info: EventClickArg) => {
      this.handleEventClick(info);
    },
    datesSet: (info: DatesSetArg) => {
      this.onDatesSet(info);
    },
    dayCellClassNames: (arg) => {
      const dateStr = this.toLocalDateStr(arg.date);
      const isHoliday = this.scheduleAvailability.isHolidayCached(dateStr);
      if (isHoliday) return ['fc-day--holiday'];
      if (!this.scheduleAvailability.getScheduleForDate(dateStr)) return ['fc-day--closed'];
      return [];
    }
  };
  calendarEvents = signal<EventSourceInput>([]);

  private isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
  private resizeTimeout?: ReturnType<typeof setTimeout>;

  @HostListener('window:resize')
  onWindowResize() {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => this.applyResponsiveCalendarView(), 150);
  }

  private applyResponsiveCalendarView() {
    const isMobile = window.innerWidth < 768;
    if (isMobile === this.isMobileView) return;
    this.isMobileView = isMobile;

    const api = this.calendarComponent?.getApi();
    if (!api) return;

    // En móvil solo el día es usable; al volver a escritorio se recupera la
    // vista que el usuario tenía antes si no era ya el día.
    if (isMobile) {
      api.changeView('timeGridDay');
    } else if (api.view.type === 'timeGridDay') {
      api.changeView(this.currentView() === 'timeGridDay' ? 'timeGridWeek' : this.currentView());
    }
  }

  ngOnInit() {
    this.computeDateRanges();
    if (this.canViewAppointments() && this.currentUserId()) {
      this.loadTodayAppointments();
    }

    this.scheduleAvailability.load().subscribe(() => {
      this.scheduleAvailability.loadAll().subscribe(() => {
        this.updateTodayScheduleText();
        if (this.weekStart) {
          this.loadWeekAppointments();
        }
      });
    });

    this.route.queryParams.subscribe(params => {
      const dateParam = params['date'];
      if (dateParam) {
        setTimeout(() => {
          if (this.calendarComponent) {
            const api = this.calendarComponent.getApi();
            api.gotoDate(dateParam);
            api.changeView('timeGridDay');
          }
        }, 300);
      }
    });
  }

  ngOnDestroy() {
    clearTimeout(this.resizeTimeout);
  }

  // ── Navegación ─────────────────────────────────────────────────────────

  navigate(direction: -1 | 1) {
    const api = this.calendarComponent?.getApi();
    if (!api) return;
    if (direction < 0) api.prev();
    else api.next();
  }

  goToToday() {
    this.calendarComponent?.getApi().today();
  }

  setViewByIndex(index: number) {
    const view = VIEW_ORDER[index];
    if (!view) return;
    this.viewIndex.set(index);

    const api = this.calendarComponent?.getApi();
    if (api) {
      api.changeView(view);
    } else {
      this.currentView.set(view);
      persistView(view);
    }
  }

  // ── Datos ──────────────────────────────────────────────────────────────

  private computeDateRanges() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    this.todayStart = startOfDay.toISOString();
    this.todayEnd = endOfDay.toISOString();

    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59);
    this.weekStart = startOfWeek.toISOString();
    this.weekEnd = endOfWeek.toISOString();
  }

  private loadTodayAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingToday.set(true);
    this.appointmentService.getByNutritionist(tenantId, this.currentUserId(), this.todayStart, this.todayEnd).subscribe({
      next: (res) => {
        this.todayAppointments.set(res || []);
        this.loadingToday.set(false);
      },
      error: () => this.loadingToday.set(false)
    });
  }

  private loadWeekAppointments() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.currentUserId();
    if (!tenantId || !userId || !this.weekStart || !this.weekEnd) return;
    this.loadingWeek.set(true);
    this.appointmentService.getByNutritionist(tenantId, userId, this.weekStart, this.weekEnd).subscribe({
      next: (res) => {
        this.weekAppointments.set(res || []);
        this.buildCalendarEvents();
        this.loadingWeek.set(false);
      },
      error: () => this.loadingWeek.set(false)
    });
  }

  /**
   * Notas y bloqueos propios del rango visible.
   *
   * El backend filtra por solapamiento, no por contención, así que devuelve
   * entradas que empiezan antes o acaban después del rango: se recortan aquí
   * para no pintar fuera de la vista.
   */
  private loadWeekNotes() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.canViewNotes() || !this.weekStart || !this.weekEnd) return;

    this.calendarNoteService.list(tenantId, this.weekStart, this.weekEnd).subscribe({
      next: (res) => {
        const notes = clipToRange(res || [], this.weekStart, this.weekEnd);
        this.weekNotes.set(notes);
        // El formulario de cita valida contra los bloqueos antes de enviar; sin
        // esto solo se enteraría por el `409` del backend.
        this.scheduleAvailability.setTimeBlocks(notes);
        this.buildCalendarEvents();
      },
      // Un fallo al traer las notas no puede dejar la agenda sin citas: se
      // vacían las notas y el calendario sigue siendo utilizable.
      error: () => {
        this.weekNotes.set([]);
        this.buildCalendarEvents();
      }
    });
  }

  private updateTodayScheduleText() {
    const dateStr = this.toLocalDateStr(new Date());
    if (this.scheduleAvailability.isHolidayCached(dateStr)) {
      this.todayScheduleText.set(this.transloco.translate('appointments.legend_holiday'));
      return;
    }
    const formatted = this.scheduleAvailability.getFormattedSchedule(dateStr);
    this.todayScheduleText.set(formatted || this.transloco.translate('appointments.legend_closed'));
  }

  private toLocalDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private buildCalendarEvents() {
    const layers = this.layers();
    // El fondo (horario y festivos) no es una capa filtrable: es el lienzo
    // sobre el que se leen las demás, y sin él no se sabe si un hueco libre
    // es que no hay nada o es que el centro está cerrado.
    const appointments = layers.appointments ? this.weekAppointments() : [];
    const events: object[] = [];

    if (this.weekStart && this.weekEnd) {
      const start = new Date(this.weekStart);
      const end = new Date(this.weekEnd);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = this.toLocalDateStr(d);
        if (this.scheduleAvailability.isHolidayCached(dateStr)) {
          events.push({
            start: dateStr,
            display: 'background',
            backgroundColor: hexToRgba(HOLIDAY_COLOR, 0.15),
          });
        } else {
          const schedule = this.scheduleAvailability.getScheduleForDate(dateStr);
          if (!schedule || schedule.details.length === 0) {
            events.push({
              start: dateStr,
              display: 'background',
              backgroundColor: hexToRgba(CLOSED_COLOR, 0.15),
            });
          } else {
            schedule.details.forEach(detail => {
              events.push({
                start: `${dateStr}T${detail.startTime}`,
                end: `${dateStr}T${detail.endTime}`,
                display: 'background',
                backgroundColor: hexToRgba(ACTIVE_HOURS_COLOR, 0.15),
              });
            });
          }
        }
      }
    }

    (appointments || []).forEach(a => {
      const statusClass = STATUS_CLASS[a.status];
      events.push({
        id: a.id,
        title: a.patientName ?? this.transloco.translate('appointments.no_patient'),
        start: a.startTime,
        end: a.endTime,
        backgroundColor: statusColor(a.status) + '20',
        borderColor: statusColor(a.status),
        classNames: statusClass ? [statusClass] : [],
        extendedProps: {
          kind: 'APPOINTMENT',
          status: a.status,
          patientName: a.patientName,
          patientId: a.patientId,
          typeName: a.typeName,
          notes: a.notes
        }
      });
    });

    this.weekNotes()
      .filter(note => (note.type === 'TIME_BLOCK' ? layers.blocks : layers.reminders))
      .forEach(note => events.push(this.buildNoteEvent(note)));

    this.calendarEvents.set(events);
  }

  /**
   * Las notas se pintan en un plano distinto al de las citas.
   *
   * Un `TIME_BLOCK` es una franja no disponible: va como evento de fondo con
   * trama diagonal (la trama, y no solo el color, es lo que lo distingue de
   * "centro cerrado", según el mínimo de accesibilidad de la guía). Un
   * `REMINDER` es informativo y va como evento normal en su color; si es
   * puntual —inicio igual que fin— se marca como chincheta en lugar de pintar
   * una franja de altura cero.
   */
  private buildNoteEvent(note: CalendarNoteDto) {
    const color = noteColor(note);
    const isBlock = note.type === 'TIME_BLOCK';
    const classNames = ['fc-event--note'];
    if (isBlock) classNames.push('fc-event--time-block');
    if (!isBlock && isPointInTime(note)) classNames.push('fc-event--note-point');

    return {
      id: `note:${note.id}`,
      title: note.title,
      start: note.startTime,
      // Una entrada puntual sin `end` evita que FullCalendar la colapse.
      end: isPointInTime(note) ? undefined : note.endTime,
      allDay: note.allDay,
      // No se usa `display: 'background'`: FullCalendar no emite `eventClick`
      // sobre los eventos de fondo y entonces un bloqueo no podría abrirse para
      // editarlo ni borrarlo. La distinción visual la da la trama en CSS.
      backgroundColor: isBlock ? hexToRgba(color, 0.18) : color + '20',
      borderColor: color,
      classNames,
      extendedProps: { kind: 'NOTE', noteId: note.id }
    };
  }

  private onDatesSet(info: DatesSetArg) {
    this.rangeLabel.set(info.view.title);

    const view = info.view.type as AgendaViewType;
    if (VIEW_ORDER.includes(view)) {
      this.currentView.set(view);
      this.viewIndex.set(VIEW_ORDER.indexOf(view));
      persistView(view);
    }

    this.weekStart = info.start.toISOString();
    this.weekEnd = info.end.toISOString();
    this.loadWeekAppointments();
    this.loadWeekNotes();
  }

  handleEventClick(info: EventClickArg | { event: { extendedProps: Record<string, unknown>; id?: string; start?: Date } }) {
    const props = info.event.extendedProps;

    if (props['kind'] === 'NOTE') {
      this.openNoteDetail(props['noteId'] as string);
      return;
    }

    const appointment = info.event.id ? this.findAppointment(info.event.id as string) : undefined;

    if ((props['status'] === 'SCHEDULED' || props['status'] === 'PROPOSED') && appointment) {
      this.modal.open<boolean, { appointment: AppointmentDto }>(
        AppointmentActionDialog,
        {
          label: `${appointment.patientName ?? this.transloco.translate('appointments.no_patient')} — ${this.getStatusLabel(appointment.status)}`,
          size: 'l',
          data: { appointment }
        }
      ).subscribe((result) => {
        if (result) {
          this.loadTodayAppointments();
          this.loadWeekAppointments();
        }
      });
    } else {
      const patientName = (props['patientName'] as string) || this.transloco.translate('appointments.no_patient');
      this.notify.info(
        `${patientName}: ${(props['typeName'] as string) || this.transloco.translate('appointments.title')} — ${this.getStatusLabel(props['status'] as string)}`
      );
    }
  }

  private openNoteDetail(noteId: string) {
    const note = this.weekNotes().find(n => n.id === noteId);
    if (!note) return;

    this.modal.open<boolean, CalendarNoteDetailData>(CalendarNoteDetailDialog, {
      label: this.transloco.translate('calendar_notes.detail_title'),
      size: 'm',
      data: { note }
    }).subscribe((changed) => {
      if (changed) this.loadWeekNotes();
    });
  }

  private findAppointment(id: string): AppointmentDto | undefined {
    return this.weekAppointments().find(a => a.id === id)
      || this.todayAppointments().find(a => a.id === id);
  }

  /**
   * Pulsar un hueco abre el mismo diálogo de creación que el botón.
   *
   * Ya no se corta en festivos, días cerrados ni fechas pasadas: un bloqueo
   * existe justamente para marcar ausencias fuera de lo previsto y las notas
   * admiten el pasado. La validación de horario sigue viva donde importa —
   * dentro del formulario de cita, que avisa si el centro está cerrado.
   */
  handleDateClick(info: DateClickArg) {
    const dateStr = this.toLocalDateStr(info.date);
    const schedule = this.scheduleAvailability.getScheduleForDate(dateStr);

    this.showCreateDialog(this.withOpeningTime(info.date, schedule?.details ?? []));
  }

  /**
   * En la vista de mes el clic llega a las 00:00; se propone la hora de
   * apertura del centro en lugar de medianoche.
   */
  private withOpeningTime(date: Date, details: { startTime: string }[]): Date {
    const result = new Date(date);
    if (date.getHours() !== 0 || date.getMinutes() !== 0) return result;

    const [hours, minutes] = (details[0]?.startTime ?? '09:00').split(':').map(Number);
    result.setHours(hours || 0, minutes || 0, 0, 0);
    return result;
  }

  markAttended(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'COMPLETED');
  }

  markNoShow(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'NO_SHOW');
  }

  cancelAppointment(appointment: AppointmentDto) {
    this.updateStatus(appointment.id, 'CANCELLED');
  }

  private updateStatus(appointmentId: string, status: AppointmentStatus) {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.updatingStatus.set(appointmentId);
    this.appointmentService.updateStatus(tenantId, appointmentId, { status: status as UpdateAppointmentStatusRequest['status'] }).subscribe({
      next: () => {
        this.notify.success(
          this.transloco.translate('appointments.update_success'),
          this.transloco.translate('common.success')
        );
        this.loadTodayAppointments();
        this.loadWeekAppointments();
        this.updatingStatus.set(null);
      },
      error: () => {
        this.notify.error(
          this.transloco.translate('appointments.update_error'),
          this.transloco.translate('common.error')
        );
        this.updatingStatus.set(null);
      }
    });
  }

  /**
   * Punto de entrada **único** para crear en la agenda.
   *
   * Si el usuario no puede gestionar notas, el selector no aporta nada y se va
   * directo al formulario de cita: un diálogo con una sola opción sería ruido.
   */
  showCreateDialog(prefilledDate?: Date) {
    if (!this.canManageNotes()) {
      this.showNewAppointmentDialog(prefilledDate);
      return;
    }

    this.modal.open<CreateEntryResult, CreateEntryDialogData>(CreateEntryDialog, {
      label: this.transloco.translate('calendar_notes.create_entry_title'),
      size: 'm',
      data: { startTime: prefilledDate }
    }).subscribe((result) => {
      if (result === 'APPOINTMENT') {
        this.showNewAppointmentDialog(prefilledDate);
      } else if (result === 'NOTE') {
        this.loadWeekNotes();
      }
    });
  }

  showNewAppointmentDialog(prefilledDate?: Date) {
    this.modal.open<boolean, { nutritionistId?: string; startTime?: Date }>(
      AppointmentFormDialog,
      {
        label: this.transloco.translate('appointments.schedule_new'),
        size: 'l',
        data: { nutritionistId: this.currentUserId(), startTime: prefilledDate }
      }
    ).subscribe((result) => {
      if (result) {
        this.loadTodayAppointments();
        this.loadWeekAppointments();
      }
    });
  }

  getStatusLabel(status: string): string {
    const key = `appointments.status_${status.toLowerCase()}`;
    return this.transloco.translate(key);
  }

  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
