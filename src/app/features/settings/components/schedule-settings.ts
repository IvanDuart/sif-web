import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { ScheduleService } from '../../../core/api/services/schedule.api';
import { HolidayService } from '../../../core/api/services/holiday.api';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { ScheduleDto, TenantScheduleAssignmentDto } from '../../../core/api/models/schedule.model';
import { HolidayDto } from '../../../core/api/models/holiday.model';
import { NotificationService, ModalService, ConfirmService } from '../../../core/ui';
import { ScheduleFormDialog, ScheduleFormDialogInput } from './schedule-form.dialog';
import { HolidayFormDialog } from './holiday-form.dialog';
import { AssignmentFormDialog, AssignmentFormDialogInput } from './assignment-form.dialog';
import { TuiTabs } from '@taiga-ui/kit';
import { TuiButton } from '@taiga-ui/core';
import { TuiTable } from '@taiga-ui/addon-table';

const DAY_NAMES = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

@Component({
  selector: 'app-schedule-settings',
  standalone: true,
  imports: [TranslocoDirective, TuiTabs, TuiButton, TuiTable],
  templateUrl: './schedule-settings.html',
})
export class ScheduleSettings implements OnInit {
  private readonly scheduleService = inject(ScheduleService);
  private readonly holidayService = inject(HolidayService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly dayNames = DAY_NAMES;

  activeSubTab = 0;

  schedules = signal<ScheduleDto[]>([]);
  assignments = signal<TenantScheduleAssignmentDto[]>([]);
  holidays = signal<HolidayDto[]>([]);

  loadingSchedules = signal(false);
  loadingAssignments = signal(false);
  loadingHolidays = signal(false);
  importingHolidays = signal(false);

  ngOnInit() {
    this.loadSchedules();
    this.loadAssignments();
    this.loadHolidays();
  }

  loadSchedules() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingSchedules.set(true);
    this.scheduleService.getAll(tenantId).subscribe({
      next: (res) => { this.schedules.set(res); this.loadingSchedules.set(false); },
      error: () => this.loadingSchedules.set(false),
    });
  }

  loadAssignments() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingAssignments.set(true);
    this.scheduleService.getAssignments(tenantId).subscribe({
      next: (res) => { this.assignments.set(res); this.loadingAssignments.set(false); },
      error: () => this.loadingAssignments.set(false),
    });
  }

  loadHolidays() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingHolidays.set(true);
    this.holidayService.getAll(tenantId).subscribe({
      next: (res) => { this.holidays.set(res); this.loadingHolidays.set(false); },
      error: () => this.loadingHolidays.set(false),
    });
  }

  getActiveDays(details: ScheduleDto['details']): string {
    const days = [...new Set(details.map(d => d.dayOfWeek))].sort();
    return days.map(d => DAY_NAMES[d]).join(', ');
  }

  showScheduleForm(schedule?: ScheduleDto) {
    this.modal.open<boolean, ScheduleFormDialogInput>(ScheduleFormDialog, {
      label: this.transloco.translate(schedule ? 'schedule_settings.edit_schedule' : 'schedule_settings.create_schedule'),
      size: 'l',
      data: schedule ? { schedule } : undefined,
    }).subscribe((result) => {
      if (result) this.loadSchedules();
    });
  }

  confirmDeleteSchedule(schedule: ScheduleDto) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('schedule_settings.delete_schedule_confirm', { name: schedule.name }),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.scheduleService.delete(tenantId, schedule.id).subscribe({
          next: () => {
            this.notify.success(this.transloco.translate('schedule_settings.schedule_deleted'));
            this.loadSchedules();
          },
          error: () => {
            this.notify.error(this.transloco.translate('schedule_settings.delete_schedule_disabled'));
          }
        });
      }
    });
  }

  showAssignmentForm(assignment?: TenantScheduleAssignmentDto) {
    this.modal.open<boolean, AssignmentFormDialogInput>(AssignmentFormDialog, {
      label: this.transloco.translate(assignment ? 'schedule_settings.edit_assignment' : 'schedule_settings.create_assignment'),
      size: 'm',
      data: { schedules: this.schedules(), assignment },
    }).subscribe((result) => {
      if (result) this.loadAssignments();
    });
  }

  confirmDeleteAssignment(assignment: TenantScheduleAssignmentDto) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('schedule_settings.delete_assignment_confirm'),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.scheduleService.deleteAssignment(tenantId, assignment.id).subscribe({
          next: () => {
            this.notify.success(this.transloco.translate('schedule_settings.assignment_deleted'));
            this.loadAssignments();
          },
        });
      }
    });
  }

  showHolidayForm() {
    this.modal.open<boolean>(HolidayFormDialog, {
      label: this.transloco.translate('schedule_settings.create_holiday'),
      size: 'm',
    }).subscribe((result) => {
      if (result) this.loadHolidays();
    });
  }

  confirmDeleteHoliday(holiday: HolidayDto) {
    this.confirm.confirm({
      label: this.transloco.translate('common.attention'),
      content: this.transloco.translate('schedule_settings.delete_holiday_confirm'),
      yes: this.transloco.translate('common.yes'),
      no: this.transloco.translate('common.no'),
    }).subscribe(confirmed => {
      if (!confirmed) return;
      const tenantId = this.tenantCtx.currentTenantId();
      if (tenantId) {
        this.holidayService.delete(tenantId, holiday.id).subscribe({
          next: () => {
            this.notify.success(this.transloco.translate('schedule_settings.holiday_deleted'));
            this.loadHolidays();
          },
        });
      }
    });
  }

  importHolidays() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.importingHolidays.set(true);
    const year = new Date().getFullYear();
    this.holidayService.loadFromNager(tenantId, year).subscribe({
      next: () => {
        this.importingHolidays.set(false);
        this.notify.success(this.transloco.translate('schedule_settings.import_success'));
        this.loadHolidays();
      },
      error: () => {
        this.importingHolidays.set(false);
        this.notify.error(this.transloco.translate('schedule_settings.import_error'));
      },
    });
  }
}
