import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TranslocoTestingModule } from '@jsverse/transloco';

import { AssistantConfigDto } from '../../../core/api/models/assistant.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { MascotLookService } from './mascot-look.service';
import { LOOK_KEY } from './skins/storage';

/**
 * La skin elegida tiene que sobrevivir a la recarga del navegador.
 *
 * Antes no: al arrancar, el `defaultSkinId` del centro pisaba lo guardado
 * porque el servicio solo respetaba el look remoto, y el backend todavía
 * puede no tener `/assistant/look`.
 */
describe('la skin elegida sobrevive a la recarga', () => {
  const TENANT = 'tenant-1';

  const config = (defaultSkinId: string | null): AssistantConfigDto =>
    ({
      enabled: true,
      apiKeyConfigured: true,
      name: 'Mascota',
      tone: 'FRIENDLY',
      defaultSkinId,
      greeting: '',
      suggestedPrompts: [],
      consentRequired: false,
      consentText: null,
    }) as AssistantConfigDto;

  let avisos: jasmine.SpyObj<NotificationService>;

  const build = (): { look: MascotLookService; http: HttpTestingController } => {
    avisos = jasmine.createSpyObj<NotificationService>('NotificationService', ['warning']);
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { es: {} },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TenantContextService,
          useValue: { currentTenantId: () => TENANT },
        },
        { provide: NotificationService, useValue: avisos },
      ],
    });
    return { look: TestBed.inject(MascotLookService), http: TestBed.inject(HttpTestingController) };
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('no deja que el defaultSkinId del centro pise lo que eligió la persona', () => {
    const { look } = build();
    look.setSkin('melon');

    TestBed.resetTestingModule();
    const recargado = build();
    recargado.look.applyConfig(config('manzana'));

    expect(recargado.look.skin()).toBe('melon');
  });

  it('usa el defaultSkinId del centro cuando nadie ha elegido nada', () => {
    const { look } = build();

    look.applyConfig(config('naranja'));

    expect(look.skin()).toBe('naranja');
  });

  it('ignora un look remoto anterior a lo elegido aquí (el centro rechazó el guardado)', () => {
    const { look } = build();
    look.setSkin('melon');
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((req) => req.flush({ detail: 'pet' }, { status: 422, statusText: 'Unprocessable' }));

    TestBed.resetTestingModule();
    const recargado = build();
    recargado.look.load();
    recargado.http
      .expectOne((req) => req.url.endsWith(`/tenant/${TENANT}/assistant/look`))
      .flush({ skinId: 'manzana', accessories: [], updatedAt: '2020-01-01T00:00:00Z' });

    expect(recargado.look.skin()).toBe('melon');
  });

  it('avisa cuando el centro no acepta la mascota elegida', () => {
    const { look, http } = build();

    look.setSkin('melon');
    http
      .expectOne((req) => req.url.endsWith(`/tenant/${TENANT}/assistant/look`))
      .flush({ detail: 'pet' }, { status: 422, statusText: 'Unprocessable' });

    expect(avisos.warning).toHaveBeenCalled();
  });

  it('acepta un look remoto más reciente que el local', () => {
    const { look } = build();
    look.setSkin('melon');
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((req) => req.flush({ skinId: 'melon', accessories: [] }));

    TestBed.resetTestingModule();
    const recargado = build();
    recargado.look.load();
    recargado.http
      .expectOne((req) => req.url.endsWith(`/tenant/${TENANT}/assistant/look`))
      .flush({ skinId: 'naranja', accessories: [], updatedAt: '2999-01-01T00:00:00Z' });

    expect(recargado.look.skin()).toBe('naranja');
  });

  it('no borra la elección guardada cuando el backend no tiene look', () => {
    const { look } = build();
    look.setSkin('pina');
    TestBed.inject(HttpTestingController).match(() => true).forEach((req) => req.flush(null, { status: 404, statusText: 'Not Found' }));

    TestBed.resetTestingModule();
    const recargado = build();
    recargado.look.load();
    recargado.http
      .expectOne((req) => req.url.endsWith(`/tenant/${TENANT}/assistant/look`))
      .flush({ skinId: null, accessories: [] });

    expect(recargado.look.skin()).toBe('pina');
    expect(localStorage.getItem(LOOK_KEY)).toContain('pina');
  });
});
