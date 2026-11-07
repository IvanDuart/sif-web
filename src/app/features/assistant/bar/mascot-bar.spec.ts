import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';

import { TenantContextService } from '../../../core/tenant/tenant-context.service';
import { QuestionService } from '../copilot/question.service';
import { MascotStateService } from '../mascot-state.service';
import { MascotBar } from './mascot-bar';

describe('MascotBar', () => {
  let fixture: ComponentFixture<MascotBar>;
  let state: MascotStateService;
  let questions: QuestionService;

  const text = (selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        MascotBar,
        TranslocoTestingModule.forRoot({
          langs: {
            es: {
              assistant: {
                thinking: 'Pensando…',
                paused: 'En pausa',
                step_of: 'Paso {{n}}/{{max}}',
                placeholder: 'Pídeme algo…',
                queue_placeholder: 'Añade otra instrucción…',
              },
            },
          },
          translocoConfig: { availableLangs: ['es'], defaultLang: 'es' },
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        NG_EVENT_PLUGINS,
        {
          provide: TenantContextService,
          useValue: {
            currentTenantId: () => 't1',
            currentMembership: () => ({ tenantId: 't1', roleCode: 'NUTRITIONIST', userType: 'STAFF', permissions: [] }),
            permissions: () => new Set<string>(),
          },
        },
      ],
    });
    state = TestBed.inject(MascotStateService);
    questions = TestBed.inject(QuestionService);
    fixture = TestBed.createComponent(MascotBar);
    fixture.detectChanges();
  });

  const el = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector);

  it('en reposo la tarjeta se encoge a una pastilla, sin nada más', () => {
    expect(el('.card--pill')).not.toBeNull();
    expect(el('.say')).toBeNull();
    expect(el('.doing')).toBeNull();
  });

  it('mientras trabaja dice qué hace, y deja de ser una pastilla', () => {
    state.sending.set(true);
    fixture.detectChanges();
    expect(text('.doing__text')).toBe('Pensando…');
    expect(el('.card--pill')).toBeNull();
    expect(text('.doing__step')).toBeNull();
  });

  it('mientras trabaja, el campo dice que lo que escribas se encola', () => {
    expect((el('textarea') as HTMLTextAreaElement).placeholder).toBe('Pídeme algo…');
    state.sending.set(true);
    fixture.detectChanges();
    expect((el('textarea') as HTMLTextAreaElement).placeholder).toBe('Añade otra instrucción…');
  });

  it('pausar y detener están junto a lo que hace, no junto a lo que escribes', () => {
    expect(el('.icon--pause')).toBeNull();
    state.sending.set(true);
    fixture.detectChanges();
    expect(el('.doing .icon--pause')).not.toBeNull();
    expect(el('.doing .icon--stop')).not.toBeNull();
  });

  it('la pregunta se lee en la tarjeta, con qué contestarla debajo', () => {
    state.sending.set(true);
    void questions.ask({ kind: 'confirm', text: '¿Lo guardo?' });
    fixture.detectChanges();

    expect(text('.say__text')).toBe('¿Lo guardo?');
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.answers .chip').length).toBe(2);
  });

  it('lo que no se deshace se tiñe', () => {
    void questions.ask({ kind: 'confirm', text: '¿La borro?', dangerous: true });
    fixture.detectChanges();
    expect(el('.say--danger')).not.toBeNull();
  });

  it('una pregunta abierta ofrece sus opciones', () => {
    void questions.ask({ kind: 'ask', text: '¿Qué día?', options: ['lunes', 'martes'] });
    fixture.detectChanges();
    const chips = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.answers .chip'));
    expect(chips.map((chip) => chip.textContent?.trim())).toEqual(['lunes', 'martes']);
  });

  it('cerrar una pregunta es decir que no: dejarla abierta colgaría el turno', async () => {
    const answer = questions.ask({ kind: 'confirm', text: '¿Lo guardo?' });
    fixture.detectChanges();
    (el('.say__close') as HTMLButtonElement).click();

    expect(await answer).toEqual({ ok: false, reason: 'declined' });
  });

  it('en pausa lo dice, aunque esté trabajando', () => {
    state.sending.set(true);
    state.cursor.pause();
    fixture.detectChanges();
    expect(text('.doing__text')).toBe('En pausa');
  });

  it('la cola se ve, con qué hacer con cada cosa', () => {
    state.queued.set(['y apunta la analítica']);
    fixture.detectChanges();
    expect(text('.queued__text')).toBe('y apunta la analítica');
    expect(text('.queued__act')).not.toBeNull();
  });

  it('enviar está apagado hasta que hay algo que enviar', () => {
    expect((el('.icon--send') as HTMLButtonElement).disabled).toBeTrue();
    (fixture.componentInstance as unknown as { text: { set(v: string): void } }).text.set('hola');
    fixture.detectChanges();
    expect((el('.icon--send') as HTMLButtonElement).disabled).toBeFalse();
  });
});
