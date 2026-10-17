import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { AppointmentService } from '../../../../core/api/services/appointment.api';
import { TenantContextService } from '../../../../core/tenant/tenant-context.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { AppointmentDto } from '../../../../core/api/models/appointment.model';
import { ModalService } from '../../../../core/ui';
import {
  QuickScheduleDialog,
  QuickScheduleDialogData,
} from '../../../appointments/quick-schedule.dialog';
import { TuiButton } from '@taiga-ui/core';

@Component({
  selector: 'app-patient-next-appointment',
  standalone: true,
  imports: [CommonModule, TranslocoDirective, TuiButton],
  templateUrl: './patient-next-appointment.html'
})
export class PatientNextAppointment implements OnInit {
  private readonly appointmentService = inject(AppointmentService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly transloco = inject(TranslocoService);

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

  /**
   * Reagenda con el mismo agendado rápido del panel del profesional: así el
   * paciente elige entre las horas que de verdad quedan libres en la agenda de
   * su nutricionista en vez de escribir una hora a ciegas. El `PATCH` que se
   * manda es el de siempre, así que su cambio vuelve a quedar como propuesta.
   */
  reschedule(appt: AppointmentDto) {
    this.modal.open<boolean, QuickScheduleDialogData>(QuickScheduleDialog, {
      label: this.transloco.translate('appointments.reschedule_title'),
      size: 'l',
      data: { appointment: appt },
    }).subscribe((result) => {
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
    return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
}
