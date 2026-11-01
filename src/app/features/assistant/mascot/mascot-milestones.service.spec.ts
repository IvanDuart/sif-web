import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { signal } from '@angular/core';

import { TranslocoTestingModule } from '@jsverse/transloco';

import { AssistantMilestoneDto } from '../../../core/api/models/assistant.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import {
  CELEBRATION_MS,
  MascotMilestonesService,
  MAX_PER_READ,
  MIN_READ_GAP_MS,
  REFRESH_DELAY_MS,
  pendingCelebrations,
} from './mascot-milestones.service';
import { MascotMoodService } from './mascot-mood.service';
import { MascotPreferencesService } from './mascot-preferences.service';

const TEXTS = {
  assistant: {
    milestone: {
      first_patient: { title: '¡Tu primer paciente!', text: 'Ya tienes a quien cuidar.' },
      first_appointment: { title: '¡Tu primera cita!', text: 'La agenda ya dice algo.' },
      first_measurement: { title: '¡Tu primera medición!', text: 'Ya hay con qué comparar.' },
      first_menu: { title: '¡Tu primer menú!', text: 'Que aproveche.' },
      first_menu_template: { title: '¡Tu primera plantilla!', text: 'Sirve para la próxima.' },
      first_shopping_list: { title: '¡Tu primera lista!', text: 'La parte aburrida, resuelta.' },
    },
  },
};

/**
 * Qué se celebra y qué no. Lo que decide que algo es una primera vez es
 * `reachedAt` del backend; lo que decide que no se repita es `celebratedAt`.
 */
describe('qué hay que celebrar', () => {
  const milestone = (
    code: string,
    reachedAt: string | null,
    celebratedAt: string | null = null,
  ): AssistantMilestoneDto => ({ code, reachedAt, celebratedAt });

  it('solo lo alcanzado y sin celebrar', () => {
    expect(
      pendingCelebrations([
        milestone('first_patient', '2026-09-02T09:00:00Z', '2026-09-02T09:00:05Z'),
        milestone('first_appointment', '2026-11-01T10:10:00Z'),
        milestone('first_menu', null),
      ]),
    ).toEqual(['first_appointment']);
  });

  it('ignora códigos que no conoce', () => {
    expect(pendingCelebrations([milestone('first_unicornio', '2026-11-01T10:10:00Z')])).toEqual([]);
  });

  it('las ordena como el catálogo, no como vengan', () => {
    expect(
      pendingCelebrations([
        milestone('first_menu', '2026-11-01T10:10:00Z'),
        milestone('first_patient', '2026-11-01T10:10:00Z'),
      ]),
    ).toEqual(['first_patient', 'first_menu']);
  });
});

describe('la mascota celebra las primeras veces', () => {
  const TENANT = 'tenant-1';
  let service: MascotMilestonesService;
  let mood: MascotMoodService;
  let http: HttpTestingController;
  let celebrations: ReturnType<typeof signal<boolean>>;

  const reached = (code: string): AssistantMilestoneDto => ({
    code,
    reachedAt: '2026-11-01T10:10:00Z',
    celebratedAt: null,
  });

  beforeEach(() => {
    celebrations = signal(true);
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: TEXTS },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TenantContextService, useValue: { currentTenantId: () => TENANT } },
        { provide: MascotPreferencesService, useValue: { celebrations } },
      ],
    });
    service = TestBed.inject(MascotMilestonesService);
    mood = TestBed.inject(MascotMoodService);
    http = TestBed.inject(HttpTestingController);
  });

  const serve = (milestones: AssistantMilestoneDto[]) =>
    http.expectOne((request) => request.url.endsWith('/assistant/milestones')).flush(milestones);

  it('celebra lo que está pendiente', fakeAsync(() => {
    service.load();
    serve([reached('first_appointment')]);

    expect(mood.note()?.title).toBe('¡Tu primera cita!');
    expect(mood.note()?.tone).toBe('celebrate');
    mood.unsay();
    tick(CELEBRATION_MS);
  }));

  it('deja dicho que ya se celebró, para otro dispositivo', fakeAsync(() => {
    service.load();
    serve([reached('first_menu')]);

    const marked = http.expectOne(
      (request) => request.method === 'POST' && request.url.endsWith('/milestones/first_menu/celebrated'),
    );
    expect(marked.request.url).toContain('/assistant/milestones/');
    marked.flush(null);

    mood.unsay();
    tick(CELEBRATION_MS);
  }));

  it('no celebra lo ya celebrado', fakeAsync(() => {
    service.load();
    serve([{ code: 'first_menu', reachedAt: '2026-01-01T00:00:00Z', celebratedAt: '2026-01-01T00:00:01Z' }]);

    expect(mood.note()).toBeNull();
    http.expectNone((request) => request.method === 'POST');
  }));

  it('las va soltando de una en una, no todas de golpe', fakeAsync(() => {
    service.load();
    serve([reached('first_patient'), reached('first_appointment')]);

    expect(mood.note()?.title).toBe('¡Tu primer paciente!');
    http.expectOne((request) => request.method === 'POST').flush(null);

    tick(CELEBRATION_MS);
    expect(mood.note()?.title).toBe('¡Tu primera cita!');
    http.expectOne((request) => request.method === 'POST').flush(null);

    mood.unsay();
    tick(CELEBRATION_MS);
  }));

  it('con muchas pendientes no monta una fiesta: las demás esperan', fakeAsync(() => {
    service.load();
    serve([
      reached('first_patient'),
      reached('first_appointment'),
      reached('first_measurement'),
      reached('first_menu'),
    ]);

    for (let shown = 0; shown < MAX_PER_READ; shown += 1) {
      expect(mood.note()).not.toBeNull();
      http.expectOne((request) => request.method === 'POST').flush(null);
      tick(CELEBRATION_MS);
    }

    // Solo se marcaron las que se enseñaron: las otras siguen pendientes y se
    // celebrarán la próxima vez que se lea.
    http.expectNone((request) => request.method === 'POST');
    expect(mood.note()).toBeNull();
  }));

  it('no pisa lo que la mascota esté diciendo: espera su turno', fakeAsync(() => {
    mood.say({ text: '¿Te atascaste?', actions: [{ label: 'Ayúdame', run: () => undefined }] });

    service.load();
    serve([reached('first_appointment')]);

    // La oferta de ayuda sigue ahí; la felicitación no se ha colado.
    expect(mood.note()?.text).toBe('¿Te atascaste?');
    http.expectNone((request) => request.method === 'POST');

    mood.unsay();
    tick(CELEBRATION_MS);
    expect(mood.note()?.title).toBe('¡Tu primera cita!');
    http.expectOne((request) => request.method === 'POST').flush(null);

    mood.unsay();
    tick(CELEBRATION_MS);
  }));

  it('con las celebraciones apagadas ni pregunta', () => {
    celebrations.set(false);
    service.load();

    http.expectNone((request) => request.url.endsWith('/assistant/milestones'));
    expect(mood.note()).toBeNull();
  });

  it('si el backend no contesta, no pasa nada', fakeAsync(() => {
    service.load();
    http
      .expectOne((request) => request.url.endsWith('/assistant/milestones'))
      .flush('', { status: 404, statusText: 'Not Found' });

    expect(mood.note()).toBeNull();
  }));

  describe('el aviso de que algo se guardó', () => {
    /**
     * Servicio arrancado, sin nada pendiente y con el mínimo entre lecturas ya
     * cumplido: así lo que se mide aquí es la espera, no el mínimo (que tiene
     * su propio caso más abajo).
     */
    function started(): void {
      service.load();
      serve([]);
      tick(MIN_READ_GAP_MS);
    }

    it('no mira de inmediato: deja pasar un rato', fakeAsync(() => {
      started();
      service.scheduleRefresh();

      tick(REFRESH_DELAY_MS - 1);
      http.expectNone((request) => request.url.endsWith('/assistant/milestones'));

      tick(1);
      serve([reached('first_menu')]);
      expect(mood.note()?.title).toBe('¡Tu primer menú!');

      http.expectOne((request) => request.method === 'POST').flush(null);
      mood.unsay();
      tick(CELEBRATION_MS);
    }));

    it('una ráfaga de guardados es una sola lectura', fakeAsync(() => {
      started();
      for (let save = 0; save < 20; save += 1) {
        service.scheduleRefresh();
        tick(100);
      }

      tick(REFRESH_DELAY_MS);
      serve([]);
      http.expectNone((request) => request.url.endsWith('/assistant/milestones'));
    }));

    it('guardar sin parar no aplaza la mirada para siempre', fakeAsync(() => {
      started();
      // Cada guardado vuelve a avisar, pero el primero ya puso la hora: si cada
      // aviso reiniciara la cuenta, esto no leería nunca.
      service.scheduleRefresh();
      for (let save = 0; save < 10; save += 1) {
        tick(REFRESH_DELAY_MS / 2);
        service.scheduleRefresh();
      }

      serve([]);
    }));

    it('respeta el mínimo entre lecturas', fakeAsync(() => {
      service.load();
      serve([]);
      // La lectura del arranque acaba de ocurrir, así que la siguiente espera.
      service.scheduleRefresh();

      tick(REFRESH_DELAY_MS);
      http.expectNone((request) => request.url.endsWith('/assistant/milestones'));

      tick(MIN_READ_GAP_MS - REFRESH_DELAY_MS);
      serve([]);
    }));

    it('antes del arranque no mira nada', fakeAsync(() => {
      service.scheduleRefresh();

      tick(MIN_READ_GAP_MS);
      http.expectNone((request) => request.url.endsWith('/assistant/milestones'));
    }));

    it('con las celebraciones apagadas tampoco', fakeAsync(() => {
      started();
      celebrations.set(false);
      service.scheduleRefresh();

      tick(MIN_READ_GAP_MS);
      http.expectNone((request) => request.url.endsWith('/assistant/milestones'));
    }));
  });

  it('`refresh` vuelve a mirar tras guardar algo', fakeAsync(() => {
    service.load();
    serve([]);
    expect(mood.note()).toBeNull();

    service.refresh();
    serve([reached('first_measurement')]);
    expect(mood.note()?.title).toBe('¡Tu primera medición!');

    http.expectOne((request) => request.method === 'POST').flush(null);
    mood.unsay();
    tick(CELEBRATION_MS);
  }));
});
