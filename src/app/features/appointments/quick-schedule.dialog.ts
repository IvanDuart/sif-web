import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { injectContext } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core';

import { QuickScheduleWidget } from '../tenant/dashboard/components/quick-schedule-widget';

/** Datos con los que se abre el agendado rápido desde una ficha. */
export interface QuickScheduleDialogData {
  patientId?: string;
  patientLabel?: string;
  patientEmail?: string;
  /** Profesional de la cita; si se omite, el usuario conectado. */
  nutritionistId?: string;
}

/**
 * Agendado rápido dentro de un diálogo. Reutiliza el mismo widget del panel
 * (`<app-quick-schedule>`) sin su tarjeta ni su título, ya que el propio bloque
 * de diálogo se encarga de enmarcarlo y titearlo.
 */
@Component({
  selector: 'app-quick-schedule-dialog',
  standalone: true,
  imports: [QuickScheduleWidget],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-quick-schedule
      [prefilledPatient]="prefilledPatient()"
      [nutritionistId]="nutritionistId()"
      [bordered]="false"
      [showTitle]="false"
      (scheduled)="onScheduled()" />
  `
})
export class QuickScheduleDialog {
  readonly context = injectContext<TuiDialogContext<boolean, QuickScheduleDialogData>>();

  readonly prefilledPatient = computed(() => {
    const data = this.context.data;
    if (!data?.patientId) return null;
    return { id: data.patientId, label: data.patientLabel ?? '', email: data.patientEmail };
  });

  readonly nutritionistId = computed(() => this.context.data?.nutritionistId ?? null);

  /** El widget ya avisa del éxito; aquí solo cerramos devolviendo `true`. */
  onScheduled(): void {
    this.context.completeWith(true);
  }
}
