import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import {
  TuiButton,
  TuiDialogContext,
  TuiError,
  TuiInput,
  TuiLabel,
  TuiTextfield,
} from '@taiga-ui/core';
import { TuiSwitch } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

import { AppVersionDto } from '../../core/api/models/app-version.model';
import { AppVersionService } from '../../core/api/services/app-version.api';
import { NotificationService } from '../../core/ui';

/**
 * SemVer con build opcional: `1.2.0` o `1.2.0+15`. La app móvil compara la
 * versión instalada contra este valor, así que no se acepta texto libre.
 */
export const APP_VERSION_PATTERN = /^\d+\.\d+\.\d+(\+\d+)?$/;

/**
 * Diálogo de plataforma para publicar la versión de la app móvil y decidir si
 * la actualización es obligatoria. El `GET` es público, pero solo quien tenga
 * `MANAGE_APP_VERSION` (o sea superadmin) verá y podrá guardar el cambio.
 */
@Component({
  selector: 'app-app-version-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    TranslocoDirective,
    TuiButton,
    TuiError,
    TuiInput,
    TuiLabel,
    TuiTextfield,
    TuiSwitch,
  ],
  templateUrl: './app-version.dialog.html',
})
export class AppVersionDialog implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly appVersionService = inject(AppVersionService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);
  readonly context = injectContext<TuiDialogContext<AppVersionDto | null, void>>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly failed = signal(false);
  readonly lastUpdated = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    latestVersion: ['', [Validators.required, Validators.pattern(APP_VERSION_PATTERN)]],
    mandatoryUpdate: [false],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);

    this.appVersionService.getVersion().subscribe({
      next: (version) => {
        this.form.patchValue({
          latestVersion: version.latestVersion,
          mandatoryUpdate: version.mandatoryUpdate,
        });
        this.lastUpdated.set(version.updatedAt ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  /** El mensaje solo aparece cuando el campo ya se tocó, como el resto del panel. */
  latestVersionError(): string | null {
    const control = this.form.controls.latestVersion;
    return control.invalid && control.touched
      ? this.transloco.translate('admin.app_version.latest_version_error')
      : null;
  }

  /** Quita los espacios que se cuelan al copiar y pegar la versión. */
  normalizeVersion(): void {
    const control = this.form.controls.latestVersion;
    const trimmed = control.value.trim();
    if (trimmed !== control.value) control.setValue(trimmed);
  }

  save(): void {
    if (this.saving()) return;

    // Espacios pegados al copiar la versión invalidarían el patrón sin motivo.
    const latestVersion = this.form.controls.latestVersion.value.trim();
    this.form.controls.latestVersion.setValue(latestVersion);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.appVersionService
      .updateVersion({
        latestVersion,
        mandatoryUpdate: this.form.controls.mandatoryUpdate.value,
      })
      .subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.notify.success(this.transloco.translate('admin.app_version.success_notify'));
          this.context.$implicit.next(updated);
          this.context.$implicit.complete();
        },
        error: () => {
          this.saving.set(false);
          this.notify.error(this.transloco.translate('admin.app_version.error_notify'));
        },
      });
  }
}
