import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, Observable, of, map, tap } from 'rxjs';
import { ScheduleService } from './schedule.api';
import { HolidayService } from './holiday.api';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { ScheduleDto, ScheduleDetailDto, TenantScheduleAssignmentDto } from '../models/schedule.model';
import { HolidayDto } from '../models/holiday.model';
import { CalendarNoteDto } from '../models/calendar-note.model';
import { overlapsTimeBlock } from '../../../shared/utils/calendar-notes';

@Injectable({ providedIn: 'root' })
export class ScheduleAvailabilityService {
  private readonly scheduleService = inject(ScheduleService);
  private readonly holidayService = inject(HolidayService);
  private readonly tenantCtx = inject(TenantContextService);

  private assignmentsCache = signal<TenantScheduleAssignmentDto[]>([]);
  private holidaysCache = signal<HolidayDto[]>([]);

  loadAll(): Observable<{ assignments: TenantScheduleAssignmentDto[]; holidays: HolidayDto[] }> {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of({ assignments: [], holidays: [] });

    return this.scheduleService.getAssignments(tenantId).pipe(
      tap((a) => this.assignmentsCache.set(a)),
      map((assignments) => ({ assignments, holidays: this.holidaysCache() })),
    );
  }

  load(): Observable<boolean> {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of(false);

    return forkJoin({
      holidays: this.holidayService.getAll(tenantId),
      assignments: this.scheduleService.getAssignments(tenantId),
    }).pipe(
      tap(({ holidays, assignments }) => {
        this.holidaysCache.set(holidays);
        this.assignmentsCache.set(assignments);
      }),
      map(() => true),
    );
  }

  getCachedHolidays(): HolidayDto[] {
    return this.holidaysCache();
  }

  getCachedHolidaySet(): Set<string> {
    return new Set(this.holidaysCache().map((h) => h.holidayDate));
  }

  getCachedAssignments(): TenantScheduleAssignmentDto[] {
    return this.assignmentsCache();
  }

  /**
   * Bloqueos propios ya conocidos, indexados por quien los haya cargado.
   *
   * No se piden aquí: las notas son privadas de su autor y este servicio es
   * compartido, así que quien tenga el calendario a la vista (la agenda, el
   * agendado rápido) los inyecta tras cargarlos. Sin ellos el servicio se
   * comporta exactamente igual que antes.
   */
  private timeBlocksCache = signal<CalendarNoteDto[]>([]);

  setTimeBlocks(notes: CalendarNoteDto[]): void {
    this.timeBlocksCache.set(notes.filter((n) => n.type === 'TIME_BLOCK'));
  }

  getCachedTimeBlocks(): CalendarNoteDto[] {
    return this.timeBlocksCache();
  }

  getScheduleForDate(date: string): { schedule: ScheduleDto; details: ScheduleDetailDto[] } | null {
    const dateObj = new Date(date + 'T00:00:00');
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay();

    const assignments = this.assignmentsCache();
    for (const a of assignments) {
      const from = new Date(a.validFrom + 'T00:00:00');
      const to = a.validTo ? new Date(a.validTo + 'T00:00:00') : null;
      if (dateObj >= from && (!to || dateObj <= to)) {
        const details = a.schedule.details.filter((d) => d.dayOfWeek === dayOfWeek);
        return { schedule: a.schedule, details };
      }
    }
    return null;
  }

  isHolidayCached(date: string): boolean {
    return this.holidaysCache().some((h) => h.holidayDate === date);
  }

  validateAppointmentTime(startTime: string): string | null {
    const dateStr = startTime.substring(0, 10);
    const timeStr = startTime.substring(11, 16);

    if (this.isHolidayCached(dateStr)) {
      return 'El centro está cerrado por festivo';
    }

    const schedule = this.getScheduleForDate(dateStr);
    if (!schedule || schedule.details.length === 0) {
      return 'El centro está cerrado este día';
    }

    const normTime = timeStr.substring(0, 5);
    const isWithin = schedule.details.some(
      (d) => normTime >= d.startTime.substring(0, 5) && normTime < d.endTime.substring(0, 5),
    );
    if (!isWithin) {
      return 'La hora de la cita está fuera del horario de apertura del centro';
    }

    // El backend rechaza con un `409` agendar sobre un bloqueo propio. Avisar
    // antes de enviar ahorra el viaje y explica el motivo real.
    const start = new Date(startTime);
    if (!Number.isNaN(start.getTime())) {
      const startMs = start.getTime();
      if (overlapsTimeBlock(this.timeBlocksCache(), startMs, startMs + 1)) {
        return 'Tienes esa franja bloqueada en tu calendario';
      }
    }

    return null;
  }

  getFormattedSchedule(date: string): string | null {
    const schedule = this.getScheduleForDate(date);
    if (!schedule || schedule.details.length === 0) return null;
    return schedule.details.map((d) => `${d.startTime} - ${d.endTime}`).join(', ');
  }
}
