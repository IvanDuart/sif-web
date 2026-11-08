import { Component, effect, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge } from '@taiga-ui/kit';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { DiaryService } from '../../core/api/services/diary.api';
import { AdherenceDto, DiaryEntryDto, DiaryStatus } from '../../core/api/models/diary.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { NotificationService } from '../../core/ui';

type BadgeAppearance = 'positive' | 'warning' | 'negative' | 'info' | 'neutral';

function isoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Ficha del paciente → Diario y adherencia (rango de fechas + métricas + registros). */
@Component({
  selector: 'app-patient-diary-tab',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule, TranslocoDirective, TuiButton, TuiBadge],
  templateUrl: './patient-diary-tab.html',
})
export class PatientDiaryTab {
  private readonly diaryService = inject(DiaryService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  userId = input.required<string>();

  readonly today = new Date();
  fromDate: string = isoDate(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000));
  toDate: string = isoDate(this.today);

  readonly entries = signal<DiaryEntryDto[]>([]);
  readonly adherence = signal<AdherenceDto | null>(null);
  readonly loading = signal(false);
  private loadedUserId: string | null = null;

  constructor() {
    effect(() => {
      const userId = this.userId();
      if (!userId || userId === this.loadedUserId) return;
      this.loadedUserId = userId;
      this.load();
    });
  }

  load(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.userId();
    if (!tenantId || !userId) return;

    this.loading.set(true);
    forkJoin({
      entries: this.diaryService
        .list(tenantId, userId, this.fromDate, this.toDate)
        .pipe(catchError(() => of([] as DiaryEntryDto[]))),
      adherence: this.diaryService
        .adherence(tenantId, userId, this.fromDate, this.toDate)
        .pipe(catchError(() => of(null))),
    }).subscribe({
      next: ({ entries, adherence }) => {
        this.entries.set(
          [...entries].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1))
        );
        this.adherence.set(adherence);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.adherence.set(null);
        this.loading.set(false);
        this.notify.error(this.transloco.translate('diary.load_error'));
      },
    });
  }

  applyRange(): void {
    if (this.fromDate > this.toDate) {
      this.notify.warning(this.transloco.translate('diary.invalid_range'));
      return;
    }
    this.load();
  }

  adherencePercent(): number {
    const rate = this.adherence()?.adherenceRate ?? 0;
    return Math.round(rate * 1000) / 10;
  }

  statusLabelKey(status: DiaryStatus): string {
    return `diary.status_${status.toLowerCase()}`;
  }

  statusAppearance(status: DiaryStatus): BadgeAppearance {
    switch (status) {
      case 'DONE':
        return 'positive';
      case 'PARTIAL':
        return 'warning';
      case 'SWAPPED':
        return 'info';
      default:
        return 'negative';
    }
  }
}
