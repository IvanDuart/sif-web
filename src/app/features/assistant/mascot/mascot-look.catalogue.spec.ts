import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TranslocoTestingModule } from '@jsverse/transloco';

import {
  AssistantConfigDto,
  AssistantPetDto,
} from '../../../core/api/models/assistant.model';
import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { NotificationService } from '../../../core/ui';
import { MascotLookService, whyNotSaved } from './mascot-look.service';
import { LOOK_KEY } from './skins/storage';
import { SKIN_IDS } from './skins/types';

/**
 * El armario solo puede ofrecer lo que está en las tres listas a la vez
 * (`doc/contrato-api/mascot/mascota-frontend.md` §2.4): lo que el frontend dibuja, lo que el
 * catálogo del producto sirve y lo que este centro permite. Ofrecer algo fuera
 * de ellas es prometer una mascota que al recargar vuelve a ser otra, que es
 * justo el fallo que arrastrábamos.
 */
describe('el armario solo ofrece lo que se puede guardar', () => {
  const TENANT = 'tenant-1';

  const pet = (id: string, accessories: string[] = ['orejas']): AssistantPetDto => ({
    id,
    name: id,
    supports: { accessories, expressions: [] },
  });

  const config = (allowedSkinIds: string[] = []): AssistantConfigDto =>
    ({
      enabled: true,
      apiKeyConfigured: true,
      name: 'Mascota',
      tone: 'FRIENDLY',
      defaultSkinId: null,
      greeting: '',
      suggestedPrompts: [],
      consentRequired: false,
      consentText: null,
      lookPolicy: { allowUserLook: true, allowedSkinIds, allowedAccessories: [] },
    }) as AssistantConfigDto;

  let look: MascotLookService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.removeItem(LOOK_KEY);
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
        { provide: TenantContextService, useValue: { currentTenantId: () => TENANT } },
        {
          provide: NotificationService,
          useValue: jasmine.createSpyObj<NotificationService>('NotificationService', ['warning']),
        },
      ],
    });
    look = TestBed.inject(MascotLookService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => localStorage.removeItem(LOOK_KEY));

  /** Contesta el catálogo y deja el `GET /look` sin responder (no hace falta). */
  function servePets(ids: string[], accessories = ['orejas']): void {
    look.load();
    http.expectOne((request) => request.url.endsWith('/assistant/pets')).flush(
      ids.map((id) => pet(id, accessories)),
    );
  }

  it('sin haber preguntado todavía, ofrece todo lo que sabe dibujar', () => {
    expect(look.allowedSkins()).toEqual([...SKIN_IDS]);
  });

  it('deja fuera lo que el catálogo del centro no sirve', () => {
    servePets(['manzana', 'brocoli', 'zanahoria']);

    expect(look.allowedSkins()).toEqual(['manzana', 'brocoli', 'zanahoria']);
  });

  it('ignora del catálogo lo que no sabe dibujar', () => {
    servePets(['manzana', 'kiwi', 'sandia']);

    expect(look.allowedSkins()).toEqual(['manzana']);
  });

  it('cruza el catálogo con lo que permite el centro', () => {
    look.applyConfig(config(['manzana', 'melon', 'brocoli']));
    servePets(['manzana', 'brocoli', 'zanahoria']);

    // `melon` lo permite el centro pero no está en el catálogo; `zanahoria`
    // está en el catálogo pero el centro no la permite.
    expect(look.allowedSkins()).toEqual(['manzana', 'brocoli']);
  });

  it('si no queda ninguna, al menos deja ver la puesta', () => {
    servePets(['kiwi']);

    expect(look.allowedSkins()).toEqual([look.skin()]);
  });

  it('si el catálogo no contesta, no filtra por él', () => {
    look.load();
    http
      .expectOne((request) => request.url.endsWith('/assistant/pets'))
      .flush('', { status: 404, statusText: 'Not Found' });

    expect(look.allowedSkins()).toEqual([...SKIN_IDS]);
  });

  it('filtra los complementos por lo que admite la mascota puesta', () => {
    servePets(['manzana'], []);

    expect(look.allowedAccessories()).toEqual([]);
  });
});

/**
 * Por qué no se guardó. Desde la V58/V59 el backend distingue "esa mascota no
 * existe" de "tu centro no te deja esa", y no son el mismo problema: la
 * segunda la arregla quien administra el centro.
 */
describe('el aviso dice por qué no se guardó', () => {
  const failure = (code: string | null): HttpErrorResponse =>
    new HttpErrorResponse({
      status: 422,
      error: code ? { status: 422, code, detail: 'da igual' } : 'vaya',
    });

  it('distingue la mascota que el centro no permite', () => {
    expect(whyNotSaved(failure('error.assistant_look_not_allowed'))).toBe(
      'assistant.wardrobe_not_allowed',
    );
  });

  it('distingue el centro que elige por ti', () => {
    expect(whyNotSaved(failure('error.assistant_look_disabled'))).toBe(
      'assistant.wardrobe_look_disabled',
    );
  });

  it('distingue la mascota que ya no está en el catálogo', () => {
    expect(whyNotSaved(failure('error.assistant_pet_not_found'))).toBe(
      'assistant.wardrobe_unknown_pet',
    );
  });

  it('distingue el complemento que no vale', () => {
    expect(whyNotSaved(failure('error.assistant_invalid_accessory'))).toBe(
      'assistant.wardrobe_invalid_accessory',
    );
  });

  it('con un fallo sin código, el aviso de siempre', () => {
    expect(whyNotSaved(failure(null))).toBe('assistant.wardrobe_not_saved');
    expect(whyNotSaved(null)).toBe('assistant.wardrobe_not_saved');
  });
});
