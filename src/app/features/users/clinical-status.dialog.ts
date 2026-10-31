import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { injectContext } from '@taiga-ui/polymorpheus';
import {
  TuiButton,
  TuiDialogContext,
  TuiDropdown,
  TuiError,
  TuiLabel,
  TuiTextfield,
} from '@taiga-ui/core';
import {
  TuiBadge,
  TuiChevron,
  TuiDataListWrapper,
  TuiSelect,
  TuiTextarea,
} from '@taiga-ui/kit';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { ClinicalStatusService } from '../../core/api/services/clinical-status.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import {
  ClinicalStatus,
  ClinicalStatusChangeDto,
  ClinicalStatusHistoryEntryDto,
} from '../../core/api/models/user.model';
import { NotificationService } from '../../core/ui';
import { formatInstantWithTime } from '../../shared/utils/date';

export interface ClinicalStatusDialogInput {
  patientId: string;
  patientName: string;
  currentStatus?: ClinicalStatus | null;
  currentReason?: string | null;
}

/**
 * Cambia el estado clínico de un paciente y muestra su historial (P1).
 * El estado clínico es independiente de `enabled`/Keycloak.
 */
@Component({
  selector: 'app-clinical-status-dialog',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiDropdown,
    TuiTextfield,
    TuiError,
    TuiLabel,
    TuiSelect,
    TuiDataListWrapper,
    TuiChevron,
    TuiTextarea,
    TuiBadge,
  ],
  templateUrl: './clinical-status.dialog.html'
})
export class ClinicalStatusDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly clinicalStatusService = inject(ClinicalStatusService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  readonly context = injectContext<TuiDialogContext<ClinicalStatusChangeDto | true, ClinicalStatusDialogInput>>();
  readonly patientId = this.context.data.patientId;
  readonly patientName = this.context.data.patientName;

  readonly statuses: ClinicalStatus[] = [
    'ONBOARDING',
    'ACTIVE',
    'PAUSED',
    'DISCHARGED',
    'DROPPED_OUT',
  ];

  saving = signal(false);
  loadingHistory = signal(false);
  history = signal<ClinicalStatusHistoryEntryDto[]>([]);

  readonly statusLabels = computed(() =>
    this.statuses.map(status => ({
      value: status,
      label: this.transloco.translate(this.statusLabelKey(status)),
    }))
  );

  readonly statusValues = computed(() => this.statusLabels().map(s => s.value));

  readonly statusStringify = (value: string): string =>
    this.statusLabels().find(s => s.value === value)?.label ?? value;

  form = this.fb.group({
    clinicalStatus: [this.context.data.currentStatus ?? 'ACTIVE' as ClinicalStatus, Validators.required],
    reason: [this.context.data.currentReason ?? ''],
  });

  ngOnInit(): void {
    this.loadHistory();
  }

  statusLabelKey(status: ClinicalStatus): string {
    return `clinical_status.${status.toLowerCase()}`;
  }

  statusAppearance(status: ClinicalStatus): 'positive' | 'warning' | 'neutral' | 'negative' {
    switch (status) {
      case 'ACTIVE': return 'positive';
      case 'ONBOARDING': return 'warning';
      case 'PAUSED': return 'warning';
      case 'DISCHARGED': return 'neutral';
      case 'DROPPED_OUT': return 'negative';
      default: return 'neutral';
    }
  }

  changeDate(iso: string): string {
    return formatInstantWithTime(iso);
  }

  private loadHistory(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.loadingHistory.set(true);
    this.clinicalStatusService.history(tenantId, this.patientId).subscribe({
      next: entries => {
        this.history.set(entries ?? []);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.history.set([]);
        this.loadingHistory.set(false);
      },
    });
  }

  cancel(): void {
    this.context.$implicit.complete();
  }

  submit(): void {
    if (this.form.invalid) return;
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);
    this.clinicalStatusService.update(tenantId, this.patientId, {
      clinicalStatus: raw.clinicalStatus as ClinicalStatus,
      reason: raw.reason?.trim() || null,
    }).subscribe({
      next: (result) => {
        this.saving.set(false);
        this.notify.success(
          this.transloco.translate('clinical_status.change_success'),
          this.transloco.translate('common.success')
        );
        this.context.$implicit.next(result);
        this.context.$implicit.complete();
      },
      error: () => {
        this.saving.set(false);
        this.notify.error(
          this.transloco.translate('clinical_status.change_error'),
          this.transloco.translate('common.error')
        );
      },
    });
  }
}
