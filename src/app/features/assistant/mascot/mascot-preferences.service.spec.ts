import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AssistantPreferencesDto } from '../../../core/api/models/assistant.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import {
  DEFAULT_PREFERENCES,
  LEGACY_STUCK_KEY,
  MascotPreferencesService,
  PREFERENCES_KEY,
} from './mascot-preferences.service';

/**
 * Lo que la mascota recuerda de cada persona. Dos cosas que no son obvias y por
 * eso están aquí: el `PUT` reemplaza el objeto entero (mandar un campo suelto
 * devolvería los otros tres a su valor por defecto), y el "no me lo digas más"
 * que alguien dejó dicho cuando esto solo vivía en el navegador tiene que
 * seguir valiendo ahora que vive en el centro.
 */
describe('las preferencias de la mascota', () => {
  const TENANT = 'tenant-1';

  const remote = (changes: Partial<AssistantPreferencesDto> = {}): AssistantPreferencesDto => ({
    ...DEFAULT_PREFERENCES,
    updatedAt: '2026-11-01T10:00:00Z',
    ...changes,
  });

  let preferences: MascotPreferencesService;
  let http: HttpTestingController;

  const url = (suffix: string) => (request: { url: string }) => request.url.endsWith(suffix);

  function build(): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantContextService, useValue: { currentTenantId: () => TENANT } },
      ],
    });
    preferences = TestBed.inject(MascotPreferencesService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => {
    localStorage.removeItem(PREFERENCES_KEY);
    localStorage.removeItem(LEGACY_STUCK_KEY);
    build();
  });

  afterEach(() => {
    localStorage.removeItem(PREFERENCES_KEY);
    localStorage.removeItem(LEGACY_STUCK_KEY);
  });

  it('sin saber nada todavía, todo está encendido', () => {
    expect(preferences.proactive()).toBeTrue();
    expect(preferences.stuckOffer()).toBeTrue();
    expect(preferences.celebrations()).toBeTrue();
    expect(preferences.silencedTips()).toEqual([]);
  });

  it('adopta lo que diga el centro', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(
      remote({ stuckFormOfferEnabled: false, silencedTips: ['appointment.create'] }),
    );

    expect(preferences.stuckOffer()).toBeFalse();
    expect(preferences.tipSilenced('appointment.create')).toBeTrue();
    expect(preferences.tipSilenced('menu.generate')).toBeFalse();
  });

  it('el interruptor general apaga las tres cosas', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(remote({ proactiveEnabled: false }));

    expect(preferences.stuckOffer()).toBeFalse();
    expect(preferences.celebrations()).toBeFalse();
    expect(preferences.tipSilenced('lo.que.sea')).toBeTrue();
  });

  it('manda el objeto entero, no solo lo que cambia', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(
      remote({ silencedTips: ['appointment.create'] }),
    );

    preferences.disableStuckOffer();

    const saved = http.expectOne(
      (request) => request.method === 'PUT' && request.url.endsWith('/assistant/preferences'),
    );
    // Si faltara cualquiera de los cuatro, el backend lo devolvería a su valor
    // por defecto: el tip silenciado volvería a sonar.
    expect(saved.request.body).toEqual({
      proactiveEnabled: true,
      silencedTips: ['appointment.create'],
      stuckFormOfferEnabled: false,
      celebrationsEnabled: true,
    });
  });

  it('la decisión vale antes de que el centro conteste', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(remote());

    preferences.disableStuckOffer();
    expect(preferences.stuckOffer()).toBeFalse();

    // Y sigue valiendo aunque el guardado falle.
    http
      .expectOne((request) => request.method === 'PUT')
      .flush('', { status: 503, statusText: 'Service Unavailable' });
    expect(preferences.stuckOffer()).toBeFalse();
  });

  it('lo decidido aquí sobrevive al siguiente arranque', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(remote());
    preferences.disableStuckOffer();
    http.expectOne((request) => request.method === 'PUT').flush(remote({ stuckFormOfferEnabled: false }));

    TestBed.resetTestingModule();
    build();

    // Sin haber preguntado todavía al centro, el navegador ya lo sabe.
    expect(preferences.stuckOffer()).toBeFalse();
  });

  it('silenciar un tip no lo duplica', () => {
    preferences.load();
    http.expectOne(url('/assistant/preferences')).flush(remote({ silencedTips: ['menu.generate'] }));

    preferences.silenceTip('menu.generate');
    http.expectNone((request) => request.method === 'PUT');

    preferences.silenceTip('appointment.create');
    const saved = http.expectOne((request) => request.method === 'PUT');
    expect(saved.request.body.silencedTips).toEqual(['menu.generate', 'appointment.create']);
  });

  describe('el "no me lo digas más" de cuando esto vivía solo aquí', () => {
    it('se convierte en preferencia del centro y se olvida la clave vieja', () => {
      localStorage.setItem(LEGACY_STUCK_KEY, '1');
      preferences.load();
      http.expectOne(url('/assistant/preferences')).flush(remote());

      const saved = http.expectOne((request) => request.method === 'PUT');
      expect(saved.request.body.stuckFormOfferEnabled).toBeFalse();
      expect(preferences.stuckOffer()).toBeFalse();
      expect(localStorage.getItem(LEGACY_STUCK_KEY)).toBeNull();
    });

    it('no se sube nada si el centro ya lo tenía apagado', () => {
      localStorage.setItem(LEGACY_STUCK_KEY, '1');
      preferences.load();
      http.expectOne(url('/assistant/preferences')).flush(remote({ stuckFormOfferEnabled: false }));

      http.expectNone((request) => request.method === 'PUT');
      expect(localStorage.getItem(LEGACY_STUCK_KEY)).toBeNull();
    });

    it('sin clave vieja no se toca nada', () => {
      preferences.load();
      http.expectOne(url('/assistant/preferences')).flush(remote());

      http.expectNone((request) => request.method === 'PUT');
      expect(preferences.stuckOffer()).toBeTrue();
    });
  });

  it('si el centro no contesta, se sigue con lo del navegador', () => {
    preferences.load();
    http
      .expectOne(url('/assistant/preferences'))
      .flush('', { status: 404, statusText: 'Not Found' });

    expect(preferences.stuckOffer()).toBeTrue();
  });
});
