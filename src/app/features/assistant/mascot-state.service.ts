import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, Subscription, catchError, finalize, firstValueFrom, map, of, shareReplay, switchMap, tap, throwError } from 'rxjs';

import { AssistantService } from '../../core/api/services/assistant.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { problemDetailCode, problemDetailMessage } from '../../core/http/error.interceptor';
import { MascotLookService } from './mascot/mascot-look.service';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { MascotMilestonesService } from './mascot/mascot-milestones.service';
import { MascotPreferencesService } from './mascot/mascot-preferences.service';
import { preferredTiming, type FillTiming } from './mascot/fill/animated-fill';
import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { NAVIGABLE_SCREENS } from './copilot/screen-routes';
import { InteractionToolsService } from './copilot/interaction-tools.service';
import { CursorService } from './copilot/cursor.service';
import { RouteVeilService } from './copilot/route-veil';
import { QuestionService } from './copilot/question.service';
import { runNavigate } from './copilot/tools/navigate.run';
import { NotificationService } from '../../core/ui';
import type { MascotMode } from './mascot/mascot-life.service';
import { ToolRegistryService } from './copilot/tool-registry.service';
import { ConfirmationService } from './copilot/confirmation.service';
import { PageContextService } from './copilot/page-context.service';
import { StepLimiter } from './copilot/step-limiter.service';
import { ToolRunnerService } from './copilot/tool-runner.service';
import {
  AssistantActionResponse,
  AssistantAttachmentDto,
  AssistantConfigDto,
  AssistantMessageDto,
  AssistantPendingActionDto,
  AssistantScreen,
  AssistantSessionDto,
  AssistantTurnResponse,
  AssistantUiActionDto,
  attachmentProblem,
} from '../../core/api/models/assistant.model';

export type MascotMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface MascotMessage {
  id: string;
  role: MascotMessageRole;
  content: string;
  /** El archivo que iba con él, si lo llevaba. */
  attachment?: AssistantAttachmentDto | null;
  createdAt: string;
  /** La persona cortó la respuesta: lo que hay es solo lo que llegó. */
  stopped?: boolean;
}


/**
 * El código del 403 del asistente: la ficha no es de quien pregunta. Lo
 * manda tanto al abrir sesión sobre un paciente de otro como a mitad de un
 * turno, cuando el modelo ha encontrado al paciente por su nombre y se topa
 * con el guardia al ir a escribir.
 */
const PERMISSION_DENIED = 'error.permission_denied';

/**
 * Estado global de la mascota: configuración del tenant, sesión y conversación.
 *
 * El panel se monta y desmonta al abrir/cerrar, pero el estado vive aquí para
 * no perder el hilo. La sesión se crea de forma perezosa (al abrir el panel) y
 * el backend la reutiliza mientras siga activa, así que reabrir no reinicia.
 */
@Injectable({ providedIn: 'root' })
export class MascotStateService {
  private readonly api = inject(AssistantService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly look = inject(MascotLookService);
  private readonly mood = inject(MascotMoodService);
  private readonly preferences = inject(MascotPreferencesService);
  private readonly milestones = inject(MascotMilestonesService);
  private readonly fill = inject(MascotFillService);
  private readonly notify = inject(NotificationService);
  private readonly tools = inject(ToolRegistryService);
  private readonly runner = inject(ToolRunnerService);
  private readonly limiter = inject(StepLimiter);
  private readonly pageContext = inject(PageContextService);
  private readonly confirmations = inject(ConfirmationService);
  readonly cursor = inject(CursorService);
  private readonly veil = inject(RouteVeilService);
  /** Solo por inyectarlo se declaran `ask_user`, `point_at`, `show_around` y `press`. */
  private readonly interactions = inject(InteractionToolsService);
  readonly questions = inject(QuestionService);

  readonly config = signal<AssistantConfigDto | null>(null);
  readonly configLoaded = signal(false);
  readonly open = signal(false);
  /** El armario, montado por el launcher para que cubra la página entera. */
  readonly wardrobeOpen = signal(false);

  readonly session = signal<AssistantSessionDto | null>(null);
  readonly consentRequired = signal(false);

  /**
   * Los pacientes que el backend no deja usar como `subjectUserId` (no están
   * asignados a quien mira). Con ellos la sesión se abre SIN paciente, y hay
   * que recordarlo: si no, `openPanel` vería que la sesión no apunta a la
   * ficha y se pondría a cerrarla y abrirla una y otra vez.
   */
  private readonly deniedSubjects = new Set<string>();

  /**
   * El paciente del que va la conversación **según el backend**.
   *
   * No basta con `session().subjectUserId`: esa copia es de cuando se creó la
   * sesión, y el backend la cambia por su cuenta con `set_active_patient`
   * cuando la persona nombra a alguien ("las medidas de Frink") sin tener su
   * ficha abierta. Sin esto, la propuesta que llega después no se puede llevar
   * a ninguna ficha y se quedaba siempre en la tarjeta de confirmar.
   */
  private readonly activePatientId = signal<string | null>(null);
  readonly messages = signal<MascotMessage[]>([]);
  readonly pendingAction = signal<AssistantPendingActionDto | null>(null);
  /** Lo que alguien dejó escrito para que la persona lo termine. Lo lee el panel. */
  readonly draft = signal('');
  readonly sending = signal(false);
  /** Lo que se escribió mientras la mascota estaba ocupada, en orden. */
  readonly queued = signal<string[]>([]);

  /**
   * Si la tarjeta de la barra está desplegada.
   *
   * Se abre al pulsar la mascota, y sola cuando hay algo que no puede
   * esperar: una pregunta, una escritura que confirmar o un turno en marcha.
   * Lo consultan la barra (para pintarse) y el FAB (para acoplarse a su borde
   * izquierdo), así que vive aquí y no en la barra.
   */
  readonly barOpen = computed(
    () => this.open() || this.sending() || this.pendingAction() !== null || this.questions.current() !== null,
  );
  readonly resolvingAction = signal(false);

  /**
   * El turno en vuelo, para poder cortarlo. `turnSeq` invalida también el
   * turno que aún espera a la sesión: si cambia, ese envío ya no sale.
   */
  private turn: Subscription | null = null;
  private turnBubble: string | null = null;
  private turnSeq = 0;

  /**
   * El run del backend del turno en curso. Llega con el primer `client_tool`
   * y es lo que hace falta para detenerlo de verdad (`DELETE /runs/{runId}`).
   */
  readonly activeRunId = signal<string | null>(null);
  /** Pasos de pantalla que lleva la petición en curso («Paso n»). */
  readonly clientSteps = this.limiter.used;

  /**
   * El archivo ya subido esperando al mensaje que lo lleve. Se sube en cuanto
   * se suelta —así el turno no se queda esperando diez megas— y se gasta con el
   * siguiente envío.
   */
  readonly attachment = signal<AssistantAttachmentDto | null>(null);
  readonly uploading = signal(false);

  readonly enabled = computed(() => this.config()?.enabled === true);

  /**
   * La mascota es una herramienta del centro: solo la ven nutricionistas y
   * administradores. Los pacientes tienen su propia app y no deben verla.
   */
  readonly roleAllowed = computed(() => {
    const membership = this.tenantCtx.currentMembership();
    if (!membership || membership.userType === 'PATIENT') return false;
    return membership.roleCode === 'ADMIN' || membership.roleCode === 'NUTRITIONIST';
  });

  /** Visible = el centro la activó y el rol tiene acceso. */
  readonly visible = computed(() => this.roleAllowed() && this.enabled());

  readonly name = computed(() => this.config()?.name?.trim() || 'Nuti');

  // ── Look procedural y vida (contrato v2) ──────────────────────────────
  readonly skin = this.look.skin;
  readonly accessories = this.look.accessories;
  readonly allowUserLook = this.look.allowUserLook;
  readonly allowedSkins = this.look.allowedSkins;
  readonly allowedAccessories = this.look.allowedAccessories;

  /** Lo que la mascota dice por su cuenta (una celebración, un aviso). */
  readonly note = this.mood.note;

  dismissNote(): void {
    this.mood.unsay();
  }

  /** El modo visual del orb según lo que está haciendo el asistente. */
  readonly orbMode = computed<MascotMode>(() => {
    // De lo que manda más a lo que menos: el armario tapa todo; una pausa
    // detiene el turno; una pregunta espera a la persona; y sólo después lo
    // que el turno está haciendo por dentro.
    if (this.wardrobeOpen()) return 'wardrobe';
    if (this.cursor.paused()) return 'paused';
    if (this.pendingAction() !== null || this.questions.current() !== null) return 'confirm';
    if (this.uploading()) return 'reading';
    if (this.fill.filling() || this.runner.running() !== null) return 'acting';
    // El remate de un relleno (`done`/`confused`) dura poco y debe verse aunque
    // el turno multi-paso siga mandando: `sending()` lo taparía entero.
    if (this.fill.transientMode()) return this.fill.transientMode()!;
    if (this.sending()) return 'thinking';
    if (this.open()) return 'listening';
    return 'idle';
  });
  readonly greeting = computed(() => this.session()?.greeting || this.config()?.greeting || '');
  readonly suggestedPrompts = computed(() => this.config()?.suggestedPrompts ?? []);
  readonly consentText = computed(
    () => this.config()?.consentText?.trim() || this.transloco.translate('assistant.consent_default')
  );

  private configTenantId: string | null = null;
  private loadingConfig = false;
  private sessionRequest: Observable<AssistantSessionDto | null> | null = null;
  private historyLoadedFor: string | null = null;
  /** La comprobación del turno colgado, una por sesión y compartida. */
  private hungRunCheck: { sessionId: string; done: Observable<void> } | null = null;
  private localId = 0;
  private welcomed = false;

  constructor() {
    // `navigate` se declara desde aquí, y no desde `copilot/`, porque es lo
    // único de la pantalla que necesita el router y cerrar el panel: pedirle
    // eso a `copilot/` lo ataría al estado del asistente, que es justo la
    // frontera que `assistant-module` no deja cruzar.
    this.tools.register({
      decl: {
        name: 'navigate',
        description: 'Va a una pantalla de la aplicación',
        parameters: {
          type: 'object',
          properties: {
            screen: { type: 'string', enum: [...NAVIGABLE_SCREENS] },
            patientId: { type: 'string', description: 'Id del paciente, para las pantallas de su ficha' },
            menuId: { type: 'string', description: 'Id del menú, para abrir ese menú con screen MENU' },
            date: { type: 'string', description: 'Día YYYY-MM-DD, para abrir la agenda en ese día' },
            query: { type: 'string', description: 'Texto por el que filtrar el listado' },
          },
          required: ['screen'],
        },
      },
      run: (args, { signal }) =>
        runNavigate(args, {
          router: this.router,
          fill: this.fill,
          signal,
          catalog: () => this.tools.catalog(),
          closePanel: () => this.closePanel(),
          veil: this.veil,
        }),
    });

    // Una escritura que el backend propone dentro del turno (`confirm_action`)
    // se pinta en la misma tarjeta de siempre.
    effect(() => {
      const waiting = this.confirmations.waiting();
      if (waiting) this.pendingAction.set(waiting);
    });

    // Al cambiar de tenant o de rol, la mascota se recalcula: un paciente no la
    // ve, y al volver a un rol permitido se recarga la configuración.
    effect(() => {
      const tenantId = this.tenantCtx.currentTenantId();
      const allowed = this.roleAllowed();

      if (!allowed || !tenantId) {
        this.open.set(false);
        if (!allowed) {
          this.configLoaded.set(false);
          this.configTenantId = null;
        }
        return;
      }

      if (this.configTenantId !== tenantId) {
        this.configLoaded.set(false);
        this.configTenantId = null;
      }
      this.loadConfig();
    });
  }

  /** Carga la configuración una vez por tenant. Silenciosa: si falla, no se muestra. */
  loadConfig(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.loadingConfig) return;
    if (this.configLoaded() && this.configTenantId === tenantId) return;

    this.loadingConfig = true;
    this.configTenantId = tenantId;
    this.api.getConfig(tenantId).subscribe({
      next: (config) => {
        this.loadingConfig = false;
        this.config.set(config);
        this.configLoaded.set(true);
        this.look.applyConfig(config);
        this.look.load();
        // Lo que recuerda de esta persona, solo si de verdad se la va a ver.
        if (this.visible()) {
          this.preferences.load();
          this.milestones.load();
        }
        if (!config.enabled) this.open.set(false);
      },
      error: () => {
        // Sin configuración (o sin IA contratada) la mascota no se muestra.
        this.loadingConfig = false;
        this.config.set(null);
        this.configLoaded.set(true);
        this.look.applyConfig(null);
        this.open.set(false);
      },
    });
  }

  /** Fuerza una recarga tras guardar la configuración del tenant. */
  reloadConfig(): void {
    this.configLoaded.set(false);
    this.configTenantId = null;
    this.loadConfig();
  }

  /**
   * Pulsar la mascota **abre**, y punto. No cierra.
   *
   * Cerrar la conversación es cosa del botón de plegar, que está para eso. La
   * mascota es el sitio al que se va a pedir algo, y que ese mismo sitio la
   * cerrara convertía cada pulsación en una apuesta sobre en qué estado
   * estaba, además de poder tirar una respuesta a medio leer.
   */
  toggle(): void {
    if (!this.visible()) return;
    if (this.wardrobeOpen() || this.orbMode() === 'confirm') return;

    const mode = this.orbMode();
    // Trabajando (o en pausa), la mascota es el botón de pausa/reanudar.
    if (mode === 'acting' || mode === 'thinking' || mode === 'paused') {
      this.cursor.toggle();
      return;
    }
    // Con algo terminado o celebrando, choca los cinco.
    if (mode === 'done' || this.mood.mood()?.kind === 'cheer' || this.mood.mood()?.kind === 'highfive') {
      this.mood.feel('highfive', 700);
      return;
    }
    // En la barra (escuchando/leyendo), la respuesta se escribe en su campo.
    if (this.open() || mode === 'reading' || mode === 'listening') {
      this.mood.feel('highfive', 700);
      document.querySelector<HTMLElement>('[data-mascot-bar-input]')?.focus();
      return;
    }
    this.openPanel();
  }

  /**
   * Abre el panel con el mensaje ya escrito, a medias y sin enviar.
   *
   * Es lo que necesita un tip: "Crea una cita con " no es una orden completa,
   * así que enviarlo sería pedirle a la mascota que adivine. Se deja escrito y
   * con el cursor al final, que es lo que haría alguien que te pasa el teclado.
   */
  openPanelWithDraft(text: string): void {
    this.draft.set(text);
    this.openPanel();
  }

  openPanel(): void {
    if (!this.visible()) return;
    this.open.set(true);

    // La primera vez en la sesión, la mascota se estira y saluda.
    if (!this.welcomed) {
      this.welcomed = true;
      this.mood.feel('welcome');
    }

    // Si el nutricionista cambia de ficha, la sesión anterior era de otro
    // paciente: se suelta aquí y `ensureSession` trae la del paciente de ahora.
    //
    // Soltarla, no cerrarla. Las sesiones del backend van por
    // `(tenant, usuario, paciente)` y no hay límite de abiertas, así que un
    // `POST /sessions` con otro paciente devuelve o crea la suya sin tocar
    // esta. Cerrarla borraba su historial y sus adjuntos para nada: volver a
    // la ficha de antes devuelve la misma conversación donde se dejó. El
    // `DELETE` se queda para cuando la persona cierra la conversación aposta.
    const session = this.session();
    if (session && this.isStaleFor(session, this.currentSubjectUserId())) {
      this.resetConversation(false);
    }

    this.ensureSession().subscribe((session) => {
      if (session) this.loadHistoryOnce(session);
    });
  }

  closePanel(): void {
    this.open.set(false);
  }

  openWardrobe(): void {
    this.wardrobeOpen.set(true);
  }

  closeWardrobe(): void {
    this.wardrobeOpen.set(false);
  }

  // ── Sesión y consentimiento ─────────────────────────────────────────

  private ensureSession(): Observable<AssistantSessionDto | null> {
    const current = this.session();
    if (current) return of(current);
    if (this.sessionRequest) return this.sessionRequest;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return of(null);

    const screen = this.currentScreen();
    const subjectUserId = this.currentSubjectUserId();

    this.sessionRequest = this.api
      // Si el nutricionista abre el asistente desde una ficha, esa ficha es el
      // paciente activo. Sin ficha, arranca sin paciente y el backend lo fija
      // después con `set_active_patient` cuando la tarea lo requiere.
      .createSession(tenantId, { subjectUserId, screen })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          // Un nutricionista sólo puede abrir sesión con SUS pacientes
          // (doc/contrato-api/assistant/assistant-frontend.md §2). Si la ficha es de otro, el panel
          // se quedaba muerto con un "no tienes permisos" a secas. Se abre sin
          // paciente: la mascota sigue sirviendo para lo general y para
          // rellenar lo que haya en pantalla, y se dice por qué.
          if (!subjectUserId || !isSubjectDenied(error)) return throwError(() => error);
          this.deniedSubjects.add(subjectUserId);
          this.pushSystem(this.transloco.translate('assistant.subject_not_allowed'));
          return this.api.createSession(tenantId, { subjectUserId: null, screen });
        }),
        tap((session) => {
          this.session.set(session);
          this.consentRequired.set(session.consentRequired);
          this.activePatientId.set(session.subjectUserId ?? null);
        }),
        catchError((error: HttpErrorResponse) => {
          this.pushSystem(this.errorMessage(error));
          return of<AssistantSessionDto | null>(null);
        }),
        // Varios consumidores (abrir el panel y enviar a la vez) comparten la
        // misma petición en vuelo en vez de crear dos sesiones.
        shareReplay(1),
        finalize(() => (this.sessionRequest = null))
      );

    return this.sessionRequest;
  }

  private loadHistoryOnce(session: AssistantSessionDto): void {
    if (this.historyLoadedFor === session.sessionId) return;
    this.historyLoadedFor = session.sessionId;

    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.api.history(tenantId, session.sessionId, null, 30).subscribe({
      next: (page) => {
        // No pisar lo que el usuario haya escrito mientras cargaba el historial.
        if (this.messages().length > 0) return;
        const history = [...(page.items ?? [])].reverse().map((message) => this.toUiMessage(message));
        if (history.length > 0) this.messages.set(history);
      },
      // El historial es opcional: si falla, la conversación sigue desde el saludo.
      error: () => undefined,
    });
  }

  acceptConsent(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const session = this.session();
    if (!tenantId || !session || this.sending()) return;

    this.sending.set(true);
    this.api.consent(tenantId, session.sessionId, true).subscribe({
      next: () => {
        this.sending.set(false);
        this.consentRequired.set(false);
        this.session.update((value) => (value ? { ...value, consentRequired: false } : value));
        this.mood.feel('cheer');
      },
      error: (error: HttpErrorResponse) => {
        this.sending.set(false);
        this.pushSystem(this.errorMessage(error));
      },
    });
  }

  declineConsent(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const session = this.session();
    if (!tenantId || !session) return;

    this.api.consent(tenantId, session.sessionId, false).subscribe({
      next: () => this.resetConversation(true),
      error: (error: HttpErrorResponse) => this.pushSystem(this.errorMessage(error)),
    });
  }

  // ── Conversación ────────────────────────────────────────────────────

  send(content: string): void {
    const text = content.trim();
    const tenantId = this.tenantCtx.currentTenantId();
    // Con un archivo delante no hace falta texto: soltar la analítica y callar
    // es una pregunta perfectamente clara.
    const attachment = this.attachment();
    if ((!text && !attachment) || !tenantId || this.consentRequired()) return;

    // Mientras hay un turno en marcha, lo que se escribe se encola en vez de
    // perderse. Antes el envío se ignoraba sin más, y lo que acababas de
    // teclear desaparecía sin decir nada.
    if (this.sending()) {
      if (text !== '') this.queued.update((queue) => [...queue, text]);
      return;
    }

    this.sending.set(true);
    this.pushUser(text, attachment);
    // Se gasta al enviarlo: el siguiente mensaje ya no lo lleva.
    this.attachment.set(null);

    const seq = ++this.turnSeq;
    this.limiter.reset();
    this.ensureSession().subscribe((session) => {
      if (seq !== this.turnSeq) return;
      if (!session) {
        this.sending.set(false);
        return;
      }

      // Un turno que se quedó colgado (recarga a mitad) se suelta antes de
      // hablar: no se puede reconectar a él y seguiría ocupando el backend.
      this.releaseHungRun(tenantId, session.sessionId).subscribe(() => {
        if (seq !== this.turnSeq) return;
        this.streamTurn(tenantId, session.sessionId, text, attachment?.id ?? null);
      });
    });
  }

  /**
   * Sube el archivo y lo deja esperando al próximo mensaje.
   *
   * Lo que no valga se dice aquí mismo, sin subirlo: el backend lo valida de
   * todas formas por magic bytes, pero hacerle esperar diez megas para decirle
   * que no admitimos ese tipo sería maleducado.
   */
  attach(file: File): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.uploading() || this.sending()) return;

    const problem = attachmentProblem(file);
    if (problem) {
      this.notify.warning(
        this.transloco.translate(
          problem === 'size' ? 'assistant.attachment_too_large' : 'assistant.attachment_unsupported',
        ),
      );
      return;
    }

    this.uploading.set(true);
    // Hace falta sesión: el adjunto vive dentro de ella.
    this.ensureSession().subscribe((session) => {
      if (!session) {
        this.uploading.set(false);
        return;
      }
      this.api.uploadAttachment(tenantId, session.sessionId, file).subscribe({
        next: (attachment) => {
          this.uploading.set(false);
          this.attachment.set(attachment);
        },
        error: (error: HttpErrorResponse) => {
          this.uploading.set(false);
          this.notify.warning(this.codeMessage(problemDetailCode(error), null));
        },
      });
    });
  }

  /** Se arrepintió antes de enviarlo. El objeto morirá con la sesión. */
  clearAttachment(): void {
    this.attachment.set(null);
  }

  /**
   * Renueva la URL firmada de un adjunto, que caduca a los 10 minutos. La pide
   * quien se encuentra con que la imagen ya no carga.
   */
  refreshAttachmentUrl(attachmentId: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.api.attachmentUrl(tenantId, attachmentId).subscribe({
      next: ({ url }) => {
        if (!url) return;
        this.messages.update((current) =>
          current.map((message) =>
            message.attachment?.id === attachmentId
              ? { ...message, attachment: { ...message.attachment, url } }
              : message,
          ),
        );
      },
      error: () => undefined,
    });
  }

  /**
   * El turno en streaming (`doc/contrato-api/assistant/assistant-frontend.md` §3.1). La mascota va
   * diciendo lo que le llega en vez de quedarse muda mientras el modelo
   * piensa; el `done` trae el turno entero, y de ahí salen las `uiActions` y
   * la escritura pendiente igual que por el camino bloqueante.
   */
  private streamTurn(
    tenantId: string,
    sessionId: string,
    text: string,
    attachmentId: string | null = null,
  ): void {
    const bubble = this.nextLocalId();
    this.turnBubble = bubble;
    let painted = '';
    let settled = false;
    // Cualquier evento demuestra que este backend tiene el stream: a partir de
    // ahí el turno ya está en marcha y reenviarlo por el bloqueante lo haría dos
    // veces. Un `client_tool` suele llegar sin texto delante.
    let started = false;

    this.runner.startTurn(sessionId);
    const request = {
      content: text,
      attachmentId,
      clientTools: this.tools.catalog(),
      pageContext: this.pageContext.build(),
    };
    this.turn = this.api.streamMessage(tenantId, sessionId, request).subscribe({
      next: (event) => {
        started = true;
        switch (event.kind) {
          case 'delta':
            // Si hablaba mientras había una tarjeta, el turno ya siguió sin ella
            // (se confirmó desde otra pestaña).
            this.releaseCard();
            painted += event.text;
            this.paintStream(bubble, painted);
            break;

          // Lo que está haciendo, sin detalles: el nombre de la tool es de
          // casa, no algo que enseñarle a nadie.
          case 'tool':
            this.mood.say({ text: this.transloco.translate('assistant.tool_running'), tone: 'neutral', ms: 2600 });
            break;

          case 'client_tool':
            if (event.call.name !== 'confirm_action') this.releaseCard();
            this.activeRunId.set(event.call.runId);
            void this.runner.handle(tenantId, event.call).then((delivery) => {
              // El backend ya no espera este turno: no llegará nada más.
              if (delivery === 'gone' && !settled && this.turnBubble === bubble) {
                settled = true;
                this.endRun(bubble);
              }
            });
            break;

          case 'stopped':
            settled = true;
            this.endRun(bubble);
            break;

          case 'done':
            settled = true;
            this.releaseCard();
            this.activeRunId.set(null);
            this.settleTurn(bubble, event.turn);
            break;

          case 'error':
            settled = true;
            this.activeRunId.set(null);
            this.runner.cancel();
            this.dropStream(bubble);
            this.sending.set(false);
            this.applyTurnErrorCode(event.code);
            this.pushSystem(this.codeMessage(event.code, event.error));
            break;
        }
      },
      error: (error: HttpErrorResponse) => {
        if (settled) return;
        this.activeRunId.set(null);
        this.runner.cancel();
        // Si se cortó sin haber pintado nada, lo más probable es que este
        // backend no tenga el stream: se reintenta por el camino de siempre.
        // Si ya había texto, NO se reintenta: el backend ya procesó el turno y
        // reenviarlo lo haría dos veces.
        if (!started) {
          // El adjunto va también por el camino de respaldo: ya está subido,
          // así que no hay que volver a subirlo, solo nombrarlo.
          this.sendBlocking(tenantId, sessionId, text, attachmentId);
          return;
        }
        this.dropStream(bubble);
        this.sending.set(false);
        this.handleTurnError(error);
      },
      complete: () => {
        if (settled) return;
        // Se cerró sin `done`: lo pintado se queda, pero no hay `uiActions` ni
        // escritura que atender.
        this.activeRunId.set(null);
        this.runner.cancel();
        this.sending.set(false);
        if (painted === '') this.pushSystem(this.transloco.translate('errors.unexpected'));
      },
    });
  }

  /** El camino bloqueante, de respaldo cuando el stream no arranca. */
  private sendBlocking(
    tenantId: string,
    sessionId: string,
    text: string,
    attachmentId: string | null = null,
  ): void {
    this.turnBubble = null;
    this.turn = this.api.sendMessage(tenantId, sessionId, text, attachmentId).subscribe({
      next: (turn) => {
        this.sending.set(false);
        this.pushAssistant(turn.assistantMessage);
        this.handleUiActions(turn.uiActions ?? []);
        this.offerAction(turn.pendingAction ?? null);
      },
      error: (error: HttpErrorResponse) => {
        this.sending.set(false);
        this.handleTurnError(error);
      },
    });
  }

  /**
   * Lo que se va pintando mientras llega. Es un mensaje más de la lista, con
   * un id local, para que el panel lo enseñe y lo desplace como a los demás.
   */
  private paintStream(id: string, content: string): void {
    this.messages.update((current) => {
      const at = current.findIndex((item) => item.id === id);
      if (at === -1) {
        return [...current, { id, role: 'ASSISTANT', content, createdAt: new Date().toISOString() }];
      }
      const next = [...current];
      next[at] = { ...next[at], content };
      return next;
    });
  }

  /**
   * Corta la respuesta en curso. Lo ya pintado se queda marcado como
   * detenido; las `uiActions` y la escritura pendiente de ese turno no se
   * aplican. El backend puede terminar el turno igualmente, y entonces el
   * historial lo traerá entero al recargar.
   */
  stop(): void {
    if (!this.sending()) return;
    this.turnSeq += 1;
    this.turn?.unsubscribe();
    this.turn = null;
    // Una tarjeta esperando se retira también del servidor: sin turno, nadie
    // podría confirmarla ya.
    const card = this.confirmations.waiting();
    this.runner.cancel();
    // Una pausa sin turno no tiene sentido, y dejaría colgado lo que esperase.
    this.cursor.release();
    if (card) this.rejectQuietly(card);

    // Cerrar el SSE ya basta para que el backend suelte el turno (lo detecta
    // por el latido), pero con el run a mano se le dice al momento.
    const runId = this.activeRunId();
    const tenantId = this.tenantCtx.currentTenantId();
    if (runId && tenantId) this.api.stopRun(tenantId, runId).subscribe({ error: () => undefined });
    this.activeRunId.set(null);

    const bubble = this.turnBubble;
    this.turnBubble = null;
    if (bubble) this.markStopped(bubble);
    this.sending.set(false);
  }

  /** El turno terminó sin `done` (`stopped`, o el backend lo perdió). */
  private endRun(bubble: string): void {
    this.releaseCard();
    this.activeRunId.set(null);
    this.runner.cancel();
    this.turn?.unsubscribe();
    this.turn = null;
    if (this.turnBubble === bubble) this.turnBubble = null;
    this.markStopped(bubble);
    this.sending.set(false);
  }

  /**
   * El turno siguió sin la tarjeta: deja de estar vinculada. Si sigue en
   * pantalla se resolverá por REST, que es lo que permite confirmarla después
   * aunque el turno haya terminado.
   */
  private releaseCard(): void {
    this.confirmations.release();
  }

  private markStopped(bubble: string): void {
    this.messages.update((current) =>
      current.map((item) => (item.id === bubble ? { ...item, stopped: true } : item))
    );
  }

  /**
   * Detiene el turno que quedó vivo en esta sesión, si lo hay. Solo lo cuenta
   * `GET /sessions/latest`; si no responde, se sigue: lo peor que pasa es que
   * el backend tarde en soltar el turno viejo. Se mira una vez por sesión,
   * antes del primer envío.
   */
  private releaseHungRun(tenantId: string, sessionId: string): Observable<void> {
    if (this.hungRunCheck?.sessionId !== sessionId) {
      const done = this.api.latestSession(tenantId, this.activePatientId()).pipe(
        switchMap((latest) =>
          latest.sessionId === sessionId && latest.pendingRunId
            ? this.api.stopRun(tenantId, latest.pendingRunId)
            : of(undefined),
        ),
        // Sin sesión viva (404), sin endpoint o run ya caducado: nada que soltar.
        catchError(() => of(undefined)),
        map(() => undefined),
        shareReplay(1),
      );
      this.hungRunCheck = { sessionId, done };
    }
    return this.hungRunCheck.done;
  }

  private dropStream(id: string): void {
    this.messages.update((current) => current.filter((item) => item.id !== id));
  }

  /**
   * Llegó el turno entero: lo pintado se cambia por el mensaje de verdad, con
   * su id del backend, para que el historial no lo duplique al recargar.
   */
  private settleTurn(bubble: string, turn: AssistantTurnResponse): void {
    this.sending.set(false);
    this.cursor.release();
    this.sendNextQueued();
    this.dropStream(bubble);
    this.pushAssistant(turn.assistantMessage);
    this.takeSubject(turn);
    this.handleUiActions(turn.uiActions ?? []);
    this.offerAction(turn.pendingAction ?? null);
  }

  /**
   * De quién habla el backend, al cerrar el turno.
   *
   * Antes se deducía del `params.patientId` de los `uiActions` de navegación.
   * La B4 los retiró, así que **sin esto la mascota pierde el hilo de con
   * quién está trabajando** en cuanto el modelo cambia de paciente a mitad de
   * conversación. Viene de la sesión y no de una navegación que podía no
   * llegar, que además es más fiable (`assistant-contract` §3 y §4).
   */
  private takeSubject(turn: AssistantTurnResponse): void {
    // `undefined` es un backend viejo que no lo manda; `null` es «ninguno», y
    // ése sí hay que obedecerlo.
    if (turn.subjectUserId === undefined) return;
    this.activePatientId.set(turn.subjectUserId);
  }

  /**
   * Lo que el asistente quiere escribir. Si el formulario está en pantalla (o
   * acaba de abrirlo con un `uiAction`), la mascota lo recorre y lo rellena
   * ella, y la acción del backend se retira: a partir de ahí manda la persona,
   * que revisa y guarda con el botón del propio formulario. Si no hay
   * formulario, se pide confirmación como siempre.
   */
  /**
   * Lo que el asistente quiere escribir: se ofrece la tarjeta y decide la
   * persona.
   *
   * Hasta F8 la mascota salía a buscar el formulario, adivinando su pantalla
   * desde el nombre de la tool, lo abría y lo rellenaba ella. Ya no hace
   * falta y además era peor: el modelo no se enteraba de nada de eso. Ahora,
   * si hay que rellenar algo en pantalla lo pide él con `fill_` y lee el
   * resultado; y si la escritura es suya, se confirma aquí y escribe el
   * backend.
   */
  private offerAction(action: AssistantPendingActionDto | null): void {
    this.pendingAction.set(action);
  }

  /** Retira la acción sin contarlo en el chat: lo que cuenta es el relleno. */
  private rejectQuietly(action: AssistantPendingActionDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    this.pendingAction.set(null);
    if (!tenantId) return;
    this.api.reject(tenantId, action.id).subscribe({ error: () => undefined });
  }

  confirmAction(action: AssistantPendingActionDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.resolvingAction()) return;

    // Dentro del turno el sí viaja como resultado de la herramienta; el
    // backend aplica la acción y el modelo sigue con lo que toque.
    if (this.confirmations.isLinked(action.id)) {
      this.pendingAction.set(null);
      this.confirmations.answer(true);
      this.mood.feel('cheer');
      this.milestones.refresh();
      return;
    }

    this.resolvingAction.set(true);
    // La clave original, tal cual: el backend hace la operación idempotente.
    this.api.confirm(tenantId, action.id, action.idempotencyKey).subscribe({
      next: (response: AssistantActionResponse) => {
        this.resolvingAction.set(false);
        this.pendingAction.set(null);
        const text = response.message?.trim() || this.transloco.translate('assistant.action_applied') || '';
        this.pushAssistantText(text);
        // La mascota lo celebra en su propia burbuja, además del chat.
        this.mood.feel('cheer');
        this.mood.say({ text: this.transloco.translate('assistant.note_done'), tone: 'celebrate' });
        // Acaba de escribir algo: puede haber sido la primera vez de algo.
        this.milestones.refresh();
        // Y lleva a ver lo que se acaba de crear, si el backend lo pide
        // (`doc/contrato-api/assistant/assistant-frontend.md` §5).
        this.handleUiActions(response.uiActions ?? []);
      },
      error: (error: HttpErrorResponse) => {
        this.resolvingAction.set(false);
        if (this.isResolvedActionError(error)) this.pendingAction.set(null);
        this.pushSystem(this.errorMessage(error));
      },
    });
  }

  rejectAction(action: AssistantPendingActionDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.resolvingAction()) return;

    if (this.confirmations.isLinked(action.id)) {
      this.pendingAction.set(null);
      this.confirmations.answer(false);
      return;
    }

    this.resolvingAction.set(true);
    this.api.reject(tenantId, action.id).subscribe({
      next: () => {
        this.resolvingAction.set(false);
        this.pendingAction.set(null);
        this.pushAssistantText(this.transloco.translate('assistant.action_cancelled'));
      },
      error: (error: HttpErrorResponse) => {
        this.resolvingAction.set(false);
        if (this.isResolvedActionError(error)) this.pendingAction.set(null);
        this.pushSystem(this.errorMessage(error));
      },
    });
  }

  private handleTurnError(error: HttpErrorResponse): void {
    this.mood.feel('worried');
    const code = problemDetailCode(error);

    if (code === 'error.assistant_session_closed' || code === 'error.assistant_session_not_found') {
      // La próxima vez se crea otra sesión; no hay replay de la conversación.
      this.session.set(null);
      this.activePatientId.set(null);
      this.consentRequired.set(false);
      this.historyLoadedFor = null;
      this.pendingAction.set(null);
    }
    if (code === 'error.assistant_consent_required') {
      this.consentRequired.set(true);
    }

    this.pushSystem(this.errorMessage(error));
  }

  /**
   * Lo que un código de error deja en el estado. Sale aparte de
   * `handleTurnError` porque el stream trae el suyo dentro del evento, no en
   * una respuesta HTTP.
   */
  private applyTurnErrorCode(code: string | null): void {
    if (code === 'error.assistant_session_closed' || code === 'error.assistant_session_not_found') {
      this.session.set(null);
      this.activePatientId.set(null);
      this.consentRequired.set(false);
      this.historyLoadedFor = null;
      this.pendingAction.set(null);
    }
    if (code === 'error.assistant_consent_required') {
      this.consentRequired.set(true);
    }
  }

  private isResolvedActionError(error: HttpErrorResponse): boolean {
    const code = problemDetailCode(error);
    return code === 'error.assistant_action_expired'
      || code === 'error.assistant_action_already_resolved'
      || code === 'error.assistant_action_not_found';
  }

  /** Paciente de la ficha abierta (`/users/:id`), si la hay. */
  private currentSubjectUserId(): string | null {
    const match = /^\/users\/([^/?#]+)/.exec(this.router.url);
    return match ? decodeURIComponent(match[1]) : null;
  }

  /** Pantalla de contexto para la primera sesión (lista blanca del contrato). */
  private currentScreen(): AssistantScreen {
    const url = this.router.url;
    if (url.startsWith('/patients')) return 'PATIENTS';
    if (url.startsWith('/appointments')) return 'AGENDA';
    if (url.startsWith('/users/')) return 'PATIENT_PROFILE';
    if (url.startsWith('/menus')) return 'MENU';
    if (url.startsWith('/settings')) return 'SETTINGS';
    return 'DASHBOARD';
  }

  // ── Navegación controlada ───────────────────────────────────────────

  /** Quita de la cola lo que ya no se quiera mandar. */
  unqueue(index: number): void {
    this.queued.update((queue) => queue.filter((_, position) => position !== index));
  }

  /**
   * «Hacer ahora»: corta el turno en marcha y manda ese mensaje. Es para
   * cuando la mascota se ha ido por donde no era y lo que importa es lo nuevo.
   */
  sendNow(index: number): void {
    const text = this.queued()[index];
    if (text === undefined) return;
    this.unqueue(index);
    this.stop();
    this.send(text);
  }

  /** Al acabar un turno, el siguiente de la cola sale solo. */
  private sendNextQueued(): void {
    const [next, ...rest] = this.queued();
    if (next === undefined) return;
    this.queued.set(rest);
    // En el siguiente tick: `sending` acaba de bajar y el turno anterior
    // todavía está asentándose.
    setTimeout(() => this.send(next));
  }

  /**
   * Lo que queda de `uiActions`: el aviso, y nada más.
   *
   * `NAVIGATE`, `OPEN_DIALOG` y `HIGHLIGHT` se retiraron en la fase B4 del
   * backend, **junto con las cuatro tools de servidor que los emitían**. Eso
   * es lo que hace seguro quitarlos de aquí: el modelo ya no tiene forma de
   * pedirlos, así que no puede creerse que navegó sin haber navegado. Ahora
   * mueve la pantalla con `navigate`, `open_<id>` y `point_at`, que además le
   * dicen si salió bien.
   *
   * El `TOAST` se queda porque no tiene equivalente: es el backend avisando de
   * algo, no la mascota actuando.
   */
  private handleUiActions(actions: AssistantUiActionDto[]): void {
    for (const action of actions) {
      if (action.type === 'TOAST') this.showToast(action.params ?? {});
    }
  }

  /** Un aviso corto, que no necesita que el panel esté abierto. */
  private showToast(params: Record<string, unknown>): void {
    const message = typeof params['message'] === 'string' ? params['message'].trim() : '';
    if (message === '') return;

    switch (params['severity']) {
      case 'success': this.notify.success(message); break;
      case 'error': this.notify.error(message); break;
      case 'warning': this.notify.warning(message); break;
      default: this.notify.info(message); break;
    }
  }

  /** Quien no quiera movimiento ve lo mismo, pero sin viaje ni tecleo. */
  private fillTiming(): FillTiming {
    return preferredTiming();
  }

  /**
   * Relee la sesión viva para ver a quién apunta ahora. Sólo se hace caso si
   * es **nuestra** sesión: `latest` es del usuario, no de la conversación, y
   * tomar el paciente de otra sería peor que no tener ninguno.
   */
  private async refreshActivePatient(): Promise<string | null> {
    const tenantId = this.tenantCtx.currentTenantId();
    const sessionId = this.session()?.sessionId;
    if (!tenantId || !sessionId) return null;

    try {
      const fresh = await firstValueFrom(this.api.latestSession(tenantId));
      if (fresh.sessionId !== sessionId) return null;
      const patientId = fresh.subjectUserId ?? null;
      if (patientId) this.activePatientId.set(patientId);
      return patientId;
    } catch {
      // Sin sesión viva (404) o sin endpoint: se sigue con lo que haya.
      return null;
    }
  }

  // ── Mensajes y errores ──────────────────────────────────────────────

  private pushUser(content: string, attachment: AssistantAttachmentDto | null = null): void {
    this.messages.update((current) => [
      ...current,
      {
        id: this.nextLocalId(),
        role: 'USER',
        content,
        attachment,
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  private pushAssistant(message: AssistantMessageDto): void {
    if (this.messages().some((item) => item.id === message.id)) return;
    this.messages.update((current) => [...current, this.toUiMessage(message)]);
  }

  private pushAssistantText(content: string): void {
    this.messages.update((current) => [
      ...current,
      { id: this.nextLocalId(), role: 'ASSISTANT', content, createdAt: new Date().toISOString() },
    ]);
  }

  private pushSystem(content: string): void {
    this.messages.update((current) => [
      ...current,
      { id: this.nextLocalId(), role: 'SYSTEM', content, createdAt: new Date().toISOString() },
    ]);
  }

  private toUiMessage(message: AssistantMessageDto): MascotMessage {
    return {
      id: message.id,
      role: message.role === 'USER' ? 'USER' : message.role === 'SYSTEM' ? 'SYSTEM' : 'ASSISTANT',
      content: message.content,
      attachment: message.attachment ?? null,
      createdAt: message.createdAt,
    };
  }

  /** Traduce el código estable del backend; si no hay clave, usa el detalle. */
  /**
   * Si la sesión abierta ya no sirve para la ficha que se está mirando. Una
   * sesión general sobre un paciente denegado sí sirve: es lo mejor que el
   * backend nos deja tener ahí.
   */
  /**
   * De quién es la sesión **según el backend**, que no siempre es de quien era
   * al crearse: la mascota mueve el paciente activo con `set_active_patient`
   * cuando alguien nombra a otro ("las medidas de Frink") sin abrir su ficha.
   * Comparar contra el `subjectUserId` de la creación sería comparar contra lo
   * que el frontend creía hace diez minutos.
   */
  private sessionSubjectId(session: AssistantSessionDto): string | null {
    return this.activePatientId() ?? session.subjectUserId ?? null;
  }

  private isStaleFor(session: AssistantSessionDto, subjectUserId: string | null): boolean {
    const current = this.sessionSubjectId(session);
    if (current === subjectUserId) return false;
    return !(subjectUserId !== null && this.deniedSubjects.has(subjectUserId) && !current);
  }

  private errorMessage(error: HttpErrorResponse): string {
    return this.codeMessage(problemDetailCode(error), problemDetailMessage(error));
  }

  /**
   * El texto de un error del turno. El **código manda sobre el `detail`** del
   * backend: un "Permiso denegado" a secas no le dice a nadie qué pasa, y el
   * 403 del asistente es siempre el mismo —la ficha no está asignada a quien
   * pregunta (`doc/contrato-api/assistant/assistant-frontend.md` §2)—, así que se dice eso, igual
   * que al abrir sesión sobre un paciente de otro.
   *
   * Sale aparte de `errorMessage` porque el stream trae su código dentro del
   * evento y no en una respuesta HTTP (§3.1), y ese camino pintaba el texto
   * crudo del backend.
   */
  private codeMessage(code: string | null, fallback: string | null): string {
    if (code === PERMISSION_DENIED) {
      return this.transloco.translate('assistant.subject_not_allowed');
    }
    if (code) {
      const key = `errors.${code.replace(/^error\./, '')}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) return translated;
    }
    return fallback?.trim() || this.transloco.translate('errors.unexpected');
  }

  /*
   * No hay quien cierre la sesión en el backend, y es a propósito: el
   * `DELETE /sessions/{id}` (`AssistantService.closeSession`) borra con ella su
   * historial y sus adjuntos, así que solo debe llamarlo un gesto deliberado de
   * la persona —"cerrar esta conversación"—, que hoy no existe en la interfaz.
   * Cambiar de ficha no lo es.
   */

  private resetConversation(closePanel: boolean): void {
    this.session.set(null);
    this.activePatientId.set(null);
    this.messages.set([]);
    this.pendingAction.set(null);
    this.consentRequired.set(false);
    this.historyLoadedFor = null;
    this.hungRunCheck = null;
    if (closePanel) this.open.set(false);
  }

  private nextLocalId(): string {
    this.localId += 1;
    return `local-${this.localId}-${Date.now()}`;
  }
}

/**
 * El 403 que dice "ese paciente no es tuyo", distinguido del resto (la IA
 * apagada del tenant es `error.assistant_disabled` y ésa sí deja el panel sin
 * nada que hacer).
 */
function isSubjectDenied(error: HttpErrorResponse): boolean {
  return error.status === 403 && problemDetailCode(error) === PERMISSION_DENIED;
}
