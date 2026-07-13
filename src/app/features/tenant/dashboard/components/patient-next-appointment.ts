import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AppointmentService } from '../../../../core/api/services/appointment.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppointmentDto } from '../../../../core/api/models/appointment.model';
import { ModalService } from '../../../../core/ui';
import { AppointmentActionDialog } from '../../../appointments/appointment-action.dialog';

@Component({
  selector: 'app-patient-next-appointment',
  standalone: true,
  imports: [CommonModule, TranslocoDirective],
  template: `
    <div *transloco="let t" class="data-card border border-surface-200 dark:border-surface-700 flex flex-col h-full justify-between">
      <div class="flex items-center gap-2 mb-4">
        <i class="fa-solid fa-calendar-day text-primary-500 text-xl"></i>
        <h3 class="text-base font-semibold text-surface-900 dark:text-surface-0">
          {{ t('patient_dashboard.next_appointment', { defaultValue: 'Próxima Cita' }) }}
        </h3>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-6">
          <i class="fa-solid fa-spinner fa-spin text-primary-500 text-xl"></i>
        </div>
      } @else if (nextAppointment(); as appt) {
        <div class="flex items-center justify-between gap-4 p-3 bg-primary-50/50 dark:bg-primary-950/20 border border-primary-100 dark:border-primary-900/50 rounded-lg">
          <div class="flex items-start gap-4 flex-1 min-w-0">
            <div class="p-3 bg-primary-500 text-white rounded-lg flex flex-col items-center justify-center min-w-[64px]">
              <span class="text-xs uppercase font-bold">{{ formatMonth(appt.startTime) }}</span>
              <span class="text-2xl font-black leading-none">{{ formatDay(appt.startTime) }}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-surface-900 dark:text-surface-0 truncate">
                {{ appt.typeName || 'Consulta Nutricional' }}
              </p>
              <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 flex items-center gap-1.5">
                <i class="fa-regular fa-clock"></i>
                {{ formatTime(appt.startTime) }} hs
              </p>
              @if (appt.nutritionistName) {
                <p class="text-xs text-surface-500 dark:text-surface-400 mt-1 flex items-center gap-1.5">
                  <i class="fa-solid fa-user-doctor"></i>
                  {{ appt.nutritionistName }}
                </p>
              }
              @if (appt.status === 'PROPOSED') {
                <span class="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  {{ t('appointments.status_proposed', { defaultValue: 'Propuesta' }) }}
                </span>
              }
            </div>
          </div>
          <button (click)="reschedule(appt)" class="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap self-center">
            <i class="fa-solid fa-calendar-check text-xs"></i>
            {{ t('appointments.reschedule') }}
          </button>
        </div>
      } @else {
        <div class="text-center py-6 text-surface-400 flex flex-col items-center justify-center">
          <i class="fa-regular fa-calendar text-2xl mb-2 text-surface-300"></i>
          <p class="text-sm">
            {{ t('patient_dashboard.no_next_appointment', { defaultValue: 'No tienes citas programadas' }) }}
          </p>
        </div>
      }
    </div>
  `
})
export class PatientNextAppointment implements OnInit {
  private readonly appointmentService = inject(AppointmentService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);

  loading = signal(false);
  nextAppointment = signal<AppointmentDto | null>(null);

  ngOnInit() {
    this.loadNextAppointment();
  }

  loadNextAppointment() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    this.loading.set(true);
    this.appointmentService.getByPatient(tenantId, userId).subscribe({
      next: (appointments) => {
        const now = new Date();
        const future = (appointments || [])
          .filter(a => (a.status === 'SCHEDULED' || a.status === 'PROPOSED') && new Date(a.startTime) > now)
          .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

        this.nextAppointment.set(future.length > 0 ? future[0] : null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  reschedule(appt: AppointmentDto) {
    this.modal.open<boolean, { appointment: AppointmentDto }>(
      AppointmentActionDialog,
      { label: 'Reagendar Cita', size: 'm', data: { appointment: appt } }
    ).subscribe((result) => {
      if (result) {
        this.loadNextAppointment();
      }
    });
  }

  formatMonth(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
  }

  formatDay(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: 'numeric' });
  }

  formatTime(isoString: string): string {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
}
