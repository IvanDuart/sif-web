import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';

import { AppVersionDialog } from './app-version.dialog';
import { AppVersionDto } from '../../core/api/models/app-version.model';
import { AppVersionService } from '../../core/api/services/app-version.api';
import { NotificationService } from '../../core/ui';

/**
 * Publicar una versión con `mandatoryUpdate` bloquea a los pacientes que no
 * actualicen: el diálogo carga el valor vigente, valida el formato y solo
 * entonces emite el cambio.
 */
describe('el diálogo de versión de la app móvil', () => {
  const current: AppVersionDto = {
    id: 'a1',
    latestVersion: '1.2.0+15',
    mandatoryUpdate: true,
    updatedAt: '2026-08-03T13:00:00Z',
  };

  let api: jasmine.SpyObj<AppVersionService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let output: Subject<AppVersionDto | null>;
  let component: AppVersionDialog;
  let fixture: ComponentFixture<AppVersionDialog>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AppVersionService>('AppVersionService', [
      'getVersion',
      'updateVersion',
    ]);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', [
      'success',
      'error',
      'warning',
    ]);
    output = new Subject<AppVersionDto | null>();

    api.getVersion.and.returnValue(of(current));
    api.updateVersion.and.returnValue(of(current));

    await TestBed.configureTestingModule({
      imports: [AppVersionDialog],
      providers: [
        { provide: AppVersionService, useValue: api },
        { provide: NotificationService, useValue: notify },
        {
          provide: TranslocoService,
          useValue: { translate: (key: string) => key, getActiveLang: () => 'es' },
        },
        { provide: POLYMORPHEUS_CONTEXT, useValue: { $implicit: output } },
      ],
    })
      .overrideComponent(AppVersionDialog, { set: { template: '', imports: [] } })
      .compileComponents();

    fixture = TestBed.createComponent(AppVersionDialog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('carga la versión vigente y su fecha', () => {
    expect(api.getVersion).toHaveBeenCalledTimes(1);
    expect(component.form.getRawValue()).toEqual({
      latestVersion: '1.2.0+15',
      mandatoryUpdate: true,
    });
    expect(component.lastUpdated()).toBe(current.updatedAt);
    expect(component.loading()).toBeFalse();
  });

  it('acepta `MAJOR.MINOR.PATCH` con build opcional', () => {
    component.form.patchValue({ latestVersion: '1.2.0' });
    expect(component.form.valid).toBeTrue();

    component.form.patchValue({ latestVersion: '1.2.0+15' });
    expect(component.form.valid).toBeTrue();
  });

  it('rechaza versiones con formato libre', () => {
    component.form.patchValue({ latestVersion: 'v1.2' });
    expect(component.form.controls.latestVersion.hasError('pattern')).toBeTrue();

    component.form.patchValue({ latestVersion: '1.2.0-beta' });
    expect(component.form.controls.latestVersion.hasError('pattern')).toBeTrue();
  });

  it('guarda la versión normalizada y emite el resultado', () => {
    const next = spyOn(output, 'next');
    const complete = spyOn(output, 'complete');
    const updated: AppVersionDto = {
      ...current,
      latestVersion: '1.3.0+2',
      mandatoryUpdate: false,
    };
    api.updateVersion.and.returnValue(of(updated));

    component.form.patchValue({
      latestVersion: '  1.3.0+2  ',
      mandatoryUpdate: false,
    });
    component.save();

    expect(api.updateVersion).toHaveBeenCalledWith({
      latestVersion: '1.3.0+2',
      mandatoryUpdate: false,
    });
    expect(notify.success).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(updated);
    expect(complete).toHaveBeenCalled();
  });

  it('no llama al backend si el formato no es válido', () => {
    component.form.patchValue({ latestVersion: '1.2' });
    component.save();

    expect(api.updateVersion).not.toHaveBeenCalled();
    expect(component.form.controls.latestVersion.touched).toBeTrue();
  });

  it('muestra el error de carga y permite reintentar', () => {
    api.getVersion.and.returnValue(throwError(() => new Error('offline')));

    component.load();

    expect(component.failed()).toBeTrue();
    expect(component.loading()).toBeFalse();

    api.getVersion.and.returnValue(of(current));
    component.load();

    expect(component.failed()).toBeFalse();
    expect(component.form.controls.latestVersion.value).toBe('1.2.0+15');
  });
});
