import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import { AssistantPendingActionDto } from '../../core/api/models/assistant.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { MascotStateService } from './mascot-state.service';

/**
 * De quién es la escritura que propone el asistente.
 *
 * Pedir "las medidas de Frink" sin tener su ficha delante acababa siempre en la
 * tarjeta de confirmar: la propuesta no dice de quién va (el backend fija el
 * paciente con `set_active_patient` **después** de crear la sesión, y la copia
 * que tiene el frontend se queda vieja), así que `/users/:patientId` no se
 * podía resolver y la mascota no iba a ninguna parte.
 */
describe('el paciente de una propuesta de escritura', () => {
  const TENANT = 'tenant-1';
  const FRINK = 'paciente-frink';
  const CARL = 'paciente-carl';

  let state: MascotStateService;
  let http: HttpTestingController;
  /** A qué ficha dice la mascota que hay que ir. */
  let goToForm: jasmine.Spy;

  const MEDICION: AssistantPendingActionDto = {
    id: 'a1',
    toolName: 'create_measurement',
    summary: 'Registrar medición corporal',
    preview: [{ field: 'weightKg', label: 'Peso (kg)', value: '100' }],
    idempotencyKey: 'k1',
    expiresAt: '2030-01-01T00:00:00Z',
  };

  const latestUrl = `/api/tenant/${TENANT}/assistant/sessions/latest`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TranslocoTestingModule.forRoot({ langs: { es: {} }, translocoConfig: { availableLangs: ['es'], defaultLang: 'es' } })],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => TENANT,
            currentMembership: () => ({ tenantId: TENANT, roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);

    // La sesión que ya está abierta, sin paciente: es el caso del problema.
    state.session.set({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: null } as never);
    onPatientFile(null);
    goToForm = spyOn(state as never, 'goToForm').and.resolveTo(undefined);
  });

  afterEach(() => {
    // El arranque del asistente (configuración, aspecto…) se pide solo al
    // montar el servicio, y una respuesta destapa la siguiente. No es de esta
    // prueba: se vacían todas menos la que sí lo es.
    for (let round = 0; round < 5; round++) {
      const pending = http.match((r) => !r.url.endsWith(latestUrl));
      if (pending.length === 0) break;
      pending.forEach((r) => r.flush({ enabled: true }));
    }
    http.verify();
  });

  /** La ficha que hay abierta en pantalla, si hay alguna. */
  function onPatientFile(patientId: string | null): void {
    const target = state as unknown as { currentSubjectUserId: () => string | null };
    if (jasmine.isSpy(target.currentSubjectUserId)) {
      (target.currentSubjectUserId as jasmine.Spy).and.returnValue(patientId);
      return;
    }
    spyOn(target, 'currentSubjectUserId').and.returnValue(patientId);
  }

  function offer(action: AssistantPendingActionDto): Promise<void> {
    return (state as unknown as { offerAction: (a: AssistantPendingActionDto) => Promise<void> }).offerAction(action);
  }

  it('relee la sesión y se va a la ficha del paciente que el backend tiene activo', async () => {
    const done = offer(MEDICION);

    http.expectOne((r) => r.url.endsWith(latestUrl) && r.method === 'GET')
      .flush({ sessionId: 's1', consentRequired: false, greeting: '', subjectUserId: FRINK });
    await done;

    expect(goToForm).toHaveBeenCalledWith('create_measurement', FRINK);
  });

  it('no se cree el paciente de una sesión que no es la suya', async () => {
    const done = offer(MEDICION);

    // `latest` es del usuario, no de la conversación: si responde otra sesión,
    // su paciente no tiene nada que ver con esta propuesta.
    http.expectOne((r) => r.url.endsWith(latestUrl) && r.method === 'GET')
      .flush({ sessionId: 'otra', consentRequired: false, greeting: '', subjectUserId: FRINK });
    await done;

    expect(goToForm).not.toHaveBeenCalledWith('create_measurement', FRINK);
  });

  it('si la propuesta dice de quién es, no hace falta preguntar', async () => {
    await offer({ ...MEDICION, subjectUserId: FRINK });

    http.expectNone((r) => r.url.endsWith(latestUrl));
    expect(goToForm).toHaveBeenCalledWith('create_measurement', FRINK);
  });

  it('con otra ficha abierta se va a la correcta en vez de escribir en la de delante', async () => {
    // Lo peligroso: el formulario de medidas de Carl está en pantalla y la
    // propuesta es de Frink. Rellenar lo que hay guardaría sus medidas en la
    // ficha de Carl.
    onPatientFile(CARL);

    await offer({ ...MEDICION, subjectUserId: FRINK });

    expect(goToForm).toHaveBeenCalledWith('create_measurement', FRINK);
  });

  it('una tool del centro no tiene paciente ni pregunta por él', async () => {
    await offer({ ...MEDICION, toolName: 'create_holiday', preview: [] });

    http.expectNone((r) => r.url.endsWith(latestUrl));
    expect(goToForm).not.toHaveBeenCalledWith('create_holiday', jasmine.any(String));
  });
});
