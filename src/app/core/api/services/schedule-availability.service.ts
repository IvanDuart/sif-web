import { Injectable, inject, signal } from '@angular/core';
import { forkJoin, Observable, of, map, tap } from 'rxjs';
import { ScheduleService } from './schedule.api';
import { HolidayService } from './holiday.api';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { ScheduleDto, ScheduleDetailDto, TenantScheduleAssignmentDto } from '../models/schedule.model';
import { HolidayDto } from '../models/holiday.model';

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

    const isWithin = schedule.details.some(
      (d) => timeStr >= d.startTime && timeStr < d.endTime,
    );
    if (!isWithin) {
      return 'La hora de la cita está fuera del horario de apertura del centro';
    }

    return null;
  }

  getFormattedSchedule(date: string): string | null {
    const schedule = this.getScheduleForDate(date);
    if (!schedule || schedule.details.length === 0) return null;
    return schedule.details.map((d) => `${d.startTime} - ${d.endTime}`).join(', ');
  }
}
