import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AppVersionService } from './app-version.api';
import { AppVersionDto } from '../models/app-version.model';
import { ConfigService } from '../../config/config.service';

/**
 * La app móvil consulta la versión al arrancar y el panel la publica. El
 * contrato vive en `/api/v1/app/version`, sin nada específico de un centro.
 */
describe('la API de versión de la app móvil', () => {
  let api: AppVersionService;
  let backend: HttpTestingController;
  const base = 'http://localhost:8080/api/v1/app/version';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: { apiUrl: 'http://localhost:8080/api' } },
      ],
    });
    api = TestBed.inject(AppVersionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('consulta la versión vigente con GET', () => {
    const dto: AppVersionDto = {
      id: 'a1',
      latestVersion: '1.2.0+15',
      mandatoryUpdate: true,
      updatedAt: '2026-08-03T13:00:00Z',
    };
    let result: AppVersionDto | undefined;

    api.getVersion().subscribe((version) => (result = version));

    const request = backend.expectOne(base);
    expect(request.request.method).toBe('GET');
    request.flush(dto);

    expect(result).toEqual(dto);
  });

  it('actualiza la versión con PUT y el cuerpo completo', () => {
    const body = { latestVersion: '1.3.0+2', mandatoryUpdate: false };
    const dto: AppVersionDto = {
      id: 'a1',
      ...body,
      updatedAt: '2026-08-04T09:30:00Z',
    };
    let result: AppVersionDto | undefined;

    api.updateVersion(body).subscribe((version) => (result = version));

    const request = backend.expectOne(base);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush(dto);

    expect(result).toEqual(dto);
  });
});
