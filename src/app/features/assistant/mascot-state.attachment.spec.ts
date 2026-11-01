import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';

import {
  ATTACHMENT_MAX_BYTES,
  attachmentProblem,
  type AssistantAttachmentDto,
} from '../../core/api/models/assistant.model';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { NotificationService } from '../../core/ui';
import { MascotStateService } from './mascot-state.service';

/** Un archivo de mentira con el tipo y el tamaño que digamos. */
function fileOf(name: string, type: string, size = 1024): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('qué archivos se pueden mandar', () => {
  it('acepta imagen y PDF', () => {
    expect(attachmentProblem(fileOf('a.jpg', 'image/jpeg'))).toBeNull();
    expect(attachmentProblem(fileOf('a.png', 'image/png'))).toBeNull();
    expect(attachmentProblem(fileOf('a.webp', 'image/webp'))).toBeNull();
    expect(attachmentProblem(fileOf('a.pdf', 'application/pdf'))).toBeNull();
  });

  it('rechaza lo que el modelo no sabe leer', () => {
    expect(attachmentProblem(fileOf('a.docx', 'application/vnd.ms-word'))).toBe('type');
    expect(attachmentProblem(fileOf('a.heic', 'image/heic'))).toBe('type');
  });

  it('rechaza lo que pasa de 10 MB', () => {
    expect(attachmentProblem(fileOf('a.pdf', 'application/pdf', ATTACHMENT_MAX_BYTES))).toBeNull();
    expect(attachmentProblem(fileOf('a.pdf', 'application/pdf', ATTACHMENT_MAX_BYTES + 1))).toBe(
      'size',
    );
  });
});

/**
 * El adjunto se sube aparte y **antes** del mensaje, así que el turno no se
 * queda esperando diez megas y el archivo no se sube dos veces si el turno
 * falla (`doc/mascota-frontend.md` §4.3).
 */
describe('un archivo en la conversación', () => {
  const TENANT = 'tenant-1';
  const SESSION = 'sesion-1';

  const uploaded: AssistantAttachmentDto = {
    id: 'adj-1',
    fileName: 'analitica.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    url: 'https://minio/firmada-1',
  };

  let state: MascotStateService;
  let http: HttpTestingController;
  let avisos: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
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
        provideRouter([]),
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => TENANT,
            currentMembership: () => ({ tenantId: TENANT, roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
          },
        },
        { provide: NotificationService, useValue: avisos },
      ],
    });
    state = TestBed.inject(MascotStateService);
    http = TestBed.inject(HttpTestingController);
    state.config.set({ enabled: true } as never);
    state.session.set({
      sessionId: SESSION,
      consentRequired: false,
      greeting: '',
      expiresAt: '',
      subjectUserId: null,
    });
  });

  const uploadUrl = `/api/tenant/${TENANT}/assistant/sessions/${SESSION}/attachments`;
  const drainHistory = () => {
    for (const open of http.match((r) => r.url.includes('/messages') && r.method === 'GET')) {
      open.flush({ items: [] });
    }
  };

  /** Deja un archivo subido y esperando. */
  function attachPdf(): void {
    state.attach(fileOf('analitica.pdf', 'application/pdf'));
    const upload = http.expectOne((r) => r.url.endsWith(uploadUrl) && r.method === 'POST');
    upload.flush(uploaded);
    drainHistory();
  }

  it('lo sube en cuanto se suelta, sin esperar al mensaje', () => {
    state.attach(fileOf('analitica.pdf', 'application/pdf'));

    const upload = http.expectOne((r) => r.url.endsWith(uploadUrl) && r.method === 'POST');
    expect(upload.request.body instanceof FormData).toBeTrue();
    expect(state.uploading()).toBeTrue();

    upload.flush(uploaded);
    expect(state.uploading()).toBeFalse();
    expect(state.attachment()?.id).toBe('adj-1');
    drainHistory();
  });

  it('lo que no vale ni se sube', () => {
    state.attach(fileOf('historia.docx', 'application/vnd.ms-word'));

    http.expectNone((r) => r.url.endsWith(uploadUrl));
    expect(avisos.warning).toHaveBeenCalled();
    expect(state.attachment()).toBeNull();
  });

  it('el mensaje lo nombra, y va por streaming como cualquier otro', () => {
    attachPdf();
    state.send('¿Me pasas estos valores?');

    const turn = http.expectOne((r) => r.url.endsWith('/messages/stream') && r.method === 'POST');
    expect(turn.request.body).toEqual({
      content: '¿Me pasas estos valores?',
      attachmentId: 'adj-1',
    });
  });

  it('se gasta al enviarlo: el siguiente mensaje ya no lo lleva', () => {
    attachPdf();
    state.send('Toma');

    expect(state.attachment()).toBeNull();
    // Y queda en la burbuja de quien lo mandó.
    const mine = state.messages().find((message) => message.role === 'USER');
    expect(mine?.attachment?.fileName).toBe('analitica.pdf');
  });

  it('un archivo sin nada escrito también es un mensaje', () => {
    attachPdf();
    state.send('');

    http.expectOne((r) => r.url.endsWith('/messages/stream') && r.method === 'POST');
  });

  it('sin archivo y sin texto no se manda nada', () => {
    state.send('   ');

    http.expectNone((r) => r.url.includes('/messages'));
  });

  it('se puede quitar antes de mandarlo', () => {
    attachPdf();
    state.clearAttachment();

    expect(state.attachment()).toBeNull();
  });

  it('renueva la URL firmada cuando la imagen ya no carga', () => {
    attachPdf();
    state.send('Toma');
    http.expectOne((r) => r.url.endsWith('/messages/stream') && r.method === 'POST');

    state.refreshAttachmentUrl('adj-1');
    http
      .expectOne((r) => r.url.endsWith(`/assistant/attachments/adj-1/url`) && r.method === 'GET')
      .flush({ url: 'https://minio/firmada-2' });

    const mine = state.messages().find((message) => message.attachment);
    expect(mine?.attachment?.url).toBe('https://minio/firmada-2');
  });

  it('si la subida falla, se dice y no queda nada esperando', () => {
    state.attach(fileOf('gorda.pdf', 'application/pdf'));
    http
      .expectOne((r) => r.url.endsWith(uploadUrl))
      .flush(
        { status: 413, code: 'error.assistant_attachment_too_large', detail: 'Muy grande' },
        { status: 413, statusText: 'Payload Too Large' },
      );

    expect(state.uploading()).toBeFalse();
    expect(state.attachment()).toBeNull();
    expect(avisos.warning).toHaveBeenCalled();
    drainHistory();
  });
});
