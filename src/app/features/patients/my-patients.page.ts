import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { SkeletonComponent } from 'boneyard-js/angular';
import { TuiTable } from '@taiga-ui/addon-table';
import { TuiButton, TuiInput } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';

import { AppointmentService } from '../../core/api/services/appointment.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { NutritionistPatientDto } from '../../core/api/models/appointment.model';
import { AppUserDto } from '../../core/api/models/user.model';
import { EmptyState } from '../../shared/ui/empty-state';
import { ModalService } from '../../core/ui';
import { AppointmentFormDialog } from '../appointments/appointment-form.dialog';
import { AssignNutritionistDialog, AssignNutritionistDialogInput } from '../users/assign-nutritionist.dialog';
import { formatInstantWithTime } from '../../shared/utils/date';

/** A patient without an upcoming appointment and idle for this long is flagged for reactivation. */
const REACTIVATION_DAYS = 60;
const DAY_MS = 86_400_000;

/**
 * "Mis pacientes" — the nutritionist's assigned cartera (V45).
 *
 * Unlike the global patient list, this page reflects the persisted titular
 * assignment (`GET /appointments/nutritionist/{id}/patients`), so it includes
 * patients with no appointments yet and patients seen months ago who stay in
 * the cartera until explicitly reassigned.
 */
@Component({
  selector: 'app-my-patients',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    TranslocoDirective,
    EmptyState,
    SkeletonComponent,
    TuiTable,
    TuiButton,
    TuiInput,
    TuiBadge,
  ],
  templateUrl: './my-patients.page.html'
})
export default class MyPatientsPage implements OnInit {
  private readonly appointmentService = inject(AppointmentService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly modal = inject(ModalService);
  private readonly transloco = inject(TranslocoService);

  patients = signal<NutritionistPatientDto[]>([]);
  loading = signal(true);
  searchControl = new FormControl('');

  protected readonly formatInstantWithTime = formatInstantWithTime;

  /** Actionable first: upcoming, then patients to reactivate, then the rest. */
  filteredPatients = computed(() => {
    const term = (this.searchControl.value || '').trim().toLowerCase();
    const sorted = [...this.patients()].sort((a, b) => {
      const rankDiff = this.rank(a) - this.rank(b);
      if (rankDiff !== 0) return rankDiff;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
    if (!term) return sorted;
    return sorted.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(term) ||
      (p.email || '').toLowerCase().includes(term)
    );
  });

  totalCount = computed(() => this.patients().length);
  upcomingCount = computed(() => this.patients().filter(p => !!p.nextAppointment).length);
  reactivationCount = computed(() => this.patients().filter(p => this.needsFollowUp(p)).length);

  ngOnInit() {
    this.loadPatients();
  }

  loadPatients() {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.appointmentService.getPatientsByNutritionist(tenantId, userId).subscribe({
      next: (res) => {
        this.patients.set(res || []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private rank(p: NutritionistPatientDto): number {
    if (p.nextAppointment) return 0;
    if (this.needsFollowUp(p)) return 1;
    return 2;
  }

  /** Assigned but idle: no upcoming appointment and either never seen or seen long ago. */
  needsFollowUp(p: NutritionistPatientDto): boolean {
    if (p.nextAppointment) return false;
    if (!p.lastAppointment) return true;
    return (Date.now() - Date.parse(p.lastAppointment)) / DAY_MS >= REACTIVATION_DAYS;
  }

  getInitials(p: NutritionistPatientDto): string {
    const first = (p.firstName ?? '').trim();
    const last = (p.lastName ?? '').trim();
    return (`${first.charAt(0)}${last.charAt(0)}` || '?').toUpperCase();
  }

  newAppointment(p: NutritionistPatientDto) {
    const userId = this.authService.user()?.id;
    if (!userId) return;

    this.modal.open<boolean, { nutritionistId: string; patientId: string; patientLabel: string }>(AppointmentFormDialog, {
      label: this.transloco.translate('appointments.schedule_new'),
      size: 'm',
      data: {
        nutritionistId: userId,
        patientId: p.patientId,
        patientLabel: `${p.firstName} ${p.lastName}`.trim()
      }
    }).subscribe((created) => {
      if (created) this.loadPatients();
    });
  }

  reassign(p: NutritionistPatientDto) {
    this.modal.open<AppUserDto | true, AssignNutritionistDialogInput>(AssignNutritionistDialog, {
      label: this.transloco.translate('users.assign_nutritionist_title'),
      size: 's',
      data: {
        patientId: p.patientId,
        patientName: `${p.firstName} ${p.lastName}`.trim(),
        // Everyone in this cartera is assigned to the current nutritionist.
        assignedNutritionistId: this.authService.user()?.id ?? null
      }
    }).subscribe((updated) => {
      if (updated) this.loadPatients();
    });
  }
}
