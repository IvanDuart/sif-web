import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { MascotFillService } from './fill/mascot-fill.service';
import { CALENDAR_NOTE_SURFACE } from './fill/surfaces/calendar-note.surface';
import { MEASUREMENT_SURFACE } from './fill/surfaces/measurement.surface';
import { PATIENT_EVENT_SURFACE } from './fill/surfaces/patient-event.surface';
import { appointmentSurface } from './fill/surfaces/appointment.surface';
import { MascotMoodService } from './mascot-mood.service';
import { MascotPreferencesService } from './mascot-preferences.service';
import {
  MascotTipsService,
  MAX_SHOWS,
  QUIET_AFTER_USE_MS,
  TIPS,
  TIP_GAP_MS,
  TIPS_SEEN_KEY,
  tipFor,
} from './mascot-tips.service';
import { MascotStateService } from '../mascot-state.service';

const TEXTS = {
  assistant: {
    tip_try: 'Pruébalo',
    tip_never: 'No me lo digas más',
    tip: {
      'appointment.create': {
        title: '¿Sabías que puedo agendar yo?',
        text: 'Dímelo y la creo.',
        prompt: 'Crea una cita con ',
      },
      'measurement.create': { title: 'Las apunto yo', text: 'Dímelos.', prompt: 'Apunta ' },
    },
  },
};

/**
 * Un tip solo vale si lo que ofrece existe. Este es el amarre: cada entrada del
 * catálogo apunta a una tool que alguna superficie de relleno sabe atender, así
 * que la mascota nunca dice "puedo hacerlo yo" de algo que no sabe hacer.
 */
describe('el catálogo de tips ofrece cosas que sabe hacer', () => {
  const fillable = new Set(
    [
      ...appointmentSurface({ patients: () => [], nutritionists: () => [], types: () => [] }).tools,
      ...MEASUREMENT_SURFACE.tools,
      ...CALENDAR_NOTE_SURFACE.tools,
      ...PATIENT_EVENT_SURFACE.tools,
    ].map(String),
  );

  it('cada tip apunta a una tool que alguna superficie rellena', () => {
    for (const tip of TIPS) {
      expect(fillable.has(tip.tool)).withContext(tip.id).toBeTrue();
    }
  });

  it('los ids son `<dominio>.<acción>` y no se repiten', () => {
    const ids = TIPS.map((tip) => tip.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z-]+\.[a-z-]+$/);
  });
});

describe('qué escritura delata cada tip', () => {
  it('reconoce crear una cita', () => {
    expect(tipFor('POST', '/api/tenant/t1/appointments')?.id).toBe('appointment.create');
  });

  it('reconoce apuntar una medición', () => {
    expect(tipFor('POST', '/api/tenant/t1/users/u1/measurements')?.id).toBe('measurement.create');
  });

  it('no confunde editar con crear', () => {
    expect(tipFor('PUT', '/api/tenant/t1/appointments')).toBeNull();
  });

  it('no se cuela por parecido', () => {
    expect(tipFor('POST', '/api/tenant/t1/appointments/a1/reschedule')).toBeNull();
    expect(tipFor('POST', '/api/tenant/t1/appointment-types')).toBeNull();
  });

  it('ignora lo que venga detrás del camino', () => {
    expect(tipFor('POST', '/api/tenant/t1/appointments?force=true')?.id).toBe('appointment.create');
  });
});

describe('cuándo se ofrece el tip y cuándo se calla', () => {
  let tips: MascotTipsService;
  let mood: MascotMoodService;
  let state: ReturnType<typeof stateStub>;
  let silenced: ReturnType<typeof signal<string[]>>;

  function stateStub() {
    return {
      visible: signal(true),
      open: signal(false),
      wardrobeOpen: signal(false),
      sending: signal(false),
      resolvingAction: signal(false),
      pendingAction: signal(null),
      draft: signal(''),
      openPanelWithDraft: jasmine.createSpy('openPanelWithDraft'),
    };
  }

  /** Una cita creada a mano, con el reloj donde se diga. */
  const saveAppointment = (now: number) =>
    tips.noticeWrite('POST', '/api/tenant/t1/appointments', now);

  /** Tan lejos de todo que nada lo frena. */
  const LATER = QUIET_AFTER_USE_MS + TIP_GAP_MS;

  beforeEach(() => {
    localStorage.removeItem(TIPS_SEEN_KEY);
    state = stateStub();
    silenced = signal<string[]>([]);
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: TEXTS },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: MascotStateService, useValue: state },
        { provide: MascotFillService, useValue: { filling: signal(false) } },
        {
          provide: MascotPreferencesService,
          useValue: {
            tipSilenced: (id: string) => silenced().includes(id),
            silenceTip: (id: string) => silenced.update((all) => [...all, id]),
          },
        },
      ],
    });
    tips = TestBed.inject(MascotTipsService);
    mood = TestBed.inject(MascotMoodService);
  });

  afterEach(() => localStorage.removeItem(TIPS_SEEN_KEY));

  it('se ofrece cuando haces a mano algo que ella sabe hacer', () => {
    saveAppointment(LATER);

    expect(mood.note()?.title).toBe('¿Sabías que puedo agendar yo?');
    expect(mood.note()?.actions?.map((action) => action.label)).toEqual([
      'Pruébalo',
      'No me lo digas más',
    ]);
  });

  it('no dice nada por guardar algo que no sabe hacer', () => {
    tips.noticeWrite('POST', '/api/tenant/t1/foods', LATER);

    expect(mood.note()).toBeNull();
  });

  it('"Pruébalo" abre el panel con el mensaje a medias, sin enviarlo', () => {
    saveAppointment(LATER);
    mood.note()?.actions?.[0].run();

    expect(state.openPanelWithDraft).toHaveBeenCalledWith('Crea una cita con ');
    // Y no vuelve a ofrecerse: ya lo sabe.
    expect(silenced()).toContain('appointment.create');
  });

  it('"No me lo digas más" lo silencia para siempre', () => {
    saveAppointment(LATER);
    mood.note()?.actions?.[1].run();
    mood.unsay();

    expect(silenced()).toContain('appointment.create');

    tips.noticeWrite('POST', '/api/tenant/t1/appointments', LATER * 10);
    expect(mood.note()).toBeNull();
  });

  it('no repite el mismo en la misma sesión', () => {
    saveAppointment(LATER);
    mood.unsay();

    saveAppointment(LATER * 10);
    expect(mood.note()).toBeNull();
  });

  it('no suelta dos tips seguidos', () => {
    saveAppointment(LATER);
    mood.unsay();

    tips.noticeWrite('POST', '/api/tenant/t1/users/u1/measurements', LATER + TIP_GAP_MS - 1);
    expect(mood.note()).toBeNull();

    tips.noticeWrite('POST', '/api/tenant/t1/users/u1/measurements', LATER + TIP_GAP_MS);
    expect(mood.note()?.title).toBe('Las apunto yo');
  });

  it('se calla justo después de haberla usado', () => {
    // Abrir el panel cuenta como usarla.
    state.open.set(true);
    TestBed.tick();
    state.open.set(false);
    TestBed.tick();

    saveAppointment(Date.now());
    expect(mood.note()).toBeNull();
  });

  it('no se ofrece mientras está ocupada', () => {
    state.sending.set(true);
    saveAppointment(LATER);

    expect(mood.note()).toBeNull();
  });

  it('no pisa lo que ya esté diciendo', () => {
    mood.say({ text: '¿Te atascaste?', actions: [{ label: 'Ayúdame', run: () => undefined }] });
    saveAppointment(LATER);

    expect(mood.note()?.text).toBe('¿Te atascaste?');
  });

  it('no se ofrece si ni siquiera se la ve', () => {
    state.visible.set(false);
    saveAppointment(LATER);

    expect(mood.note()).toBeNull();
  });

  it('deja de insistir tras unas cuantas veces en este navegador', () => {
    localStorage.setItem(TIPS_SEEN_KEY, JSON.stringify({ 'appointment.create': MAX_SHOWS }));
    saveAppointment(LATER);

    expect(mood.note()).toBeNull();
  });
});
