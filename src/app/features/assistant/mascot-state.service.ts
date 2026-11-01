import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, finalize, firstValueFrom, of, shareReplay, tap, throwError } from 'rxjs';

import { AssistantService } from '../../core/api/services/assistant.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { problemDetailCode, problemDetailMessage } from '../../core/http/error.interceptor';
import { MascotLookService } from './mascot/mascot-look.service';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { MascotMilestonesService } from './mascot/mascot-milestones.service';
import { MascotPreferencesService } from './mascot/mascot-preferences.service';
import { DEFAULT_FILL_TIMING, STILL_TIMING, playFill, playHighlight, playOpen, type FillTiming } from './mascot/fill/animated-fill';
import { matchPreview, unmatchedPreview, type FillSurface } from './mascot/fill/descriptor';
import { MascotFillService } from './mascot/fill/mascot-fill.service';
import { resolveFillRoute, routeForTool } from './mascot/fill/surfaces/routes';
import { NotificationService } from '../../core/ui';
import type { MascotMode } from './mascot/mascot-life.service';
import {
  AssistantActionResponse,
  AssistantConfigDto,
  AssistantMessageDto,
  AssistantPendingActionDto,
  AssistantScreen,
  AssistantSessionDto,
  AssistantTurnResponse,
  AssistantUiActionDto,
} from '../../core/api/models/assistant.model';

export type MascotMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface MascotMessage {
  id: string;
  role: MascotMessageRole;
  content: string;
  createdAt: string;
}

/** Lo que se le da al formulario para montar tras un `uiAction` que navega. */
const SURFACE_WAIT_MS = 1500;
/** Lo que se le da a un diálogo recién abierto para montar y apuntarse. */
const OPENED_SURFACE_WAIT_MS = 2500;

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
  readonly resolvingAction = signal(false);

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
    if (this.sending()) return 'thinking';
    if (this.pendingAction()) return 'confirm';
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
  private localId = 0;
  private welcomed = false;

  constructor() {
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

  toggle(): void {
    if (!this.visible()) return;
    if (this.open()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
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

    // Si el nutricionista cambia de ficha, la sesión anterior apuntaba a otro
    // paciente: se cierra y se abre una nueva con el subject actual.
    const session = this.session();
    if (session && this.isStaleFor(session, this.currentSubjectUserId())) {
      this.closeRemoteSession(session);
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
          // (doc/assistant-frontend.md §2). Si la ficha es de otro, el panel
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
    if (!text || !tenantId || this.sending() || this.consentRequired()) return;

    this.sending.set(true);
    this.pushUser(text);

    this.ensureSession().subscribe((session) => {
      if (!session) {
        this.sending.set(false);
        return;
      }

      this.streamTurn(tenantId, session.sessionId, text);
    });
  }

  /**
   * El turno en streaming (`doc/assistant-frontend.md` §3.1). La mascota va
   * diciendo lo que le llega en vez de quedarse muda mientras el modelo
   * piensa; el `done` trae el turno entero, y de ahí salen las `uiActions` y
   * la escritura pendiente igual que por el camino bloqueante.
   */
  private streamTurn(tenantId: string, sessionId: string, text: string): void {
    const bubble = this.nextLocalId();
    let painted = '';
    let settled = false;

    this.api.streamMessage(tenantId, sessionId, text).subscribe({
      next: (event) => {
        switch (event.kind) {
          case 'delta':
            painted += event.text;
            this.paintStream(bubble, painted);
            break;

          // Lo que está haciendo, sin detalles: el nombre de la tool es de
          // casa, no algo que enseñarle a nadie.
          case 'tool':
            this.mood.say({ text: this.transloco.translate('assistant.tool_running'), tone: 'neutral', ms: 2600 });
            break;

          case 'done':
            settled = true;
            this.settleTurn(bubble, event.turn);
            break;

          case 'error':
            settled = true;
            this.dropStream(bubble);
            this.sending.set(false);
            this.applyTurnErrorCode(event.code);
            this.pushSystem(event.error.trim() || this.transloco.translate('errors.unexpected'));
            break;
        }
      },
      error: (error: HttpErrorResponse) => {
        if (settled) return;
        // Si se cortó sin haber pintado nada, lo más probable es que este
        // backend no tenga el stream: se reintenta por el camino de siempre.
        // Si ya había texto, NO se reintenta: el backend ya procesó el turno y
        // reenviarlo lo haría dos veces.
        if (painted === '') {
          this.sendBlocking(tenantId, sessionId, text);
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
        this.sending.set(false);
        if (painted === '') this.pushSystem(this.transloco.translate('errors.unexpected'));
      },
    });
  }

  /** El camino bloqueante, de respaldo cuando el stream no arranca. */
  private sendBlocking(tenantId: string, sessionId: string, text: string): void {
    this.api.sendMessage(tenantId, sessionId, text).subscribe({
      next: (turn) => {
        this.sending.set(false);
        this.pushAssistant(turn.assistantMessage);
        void this.handleUiActions(turn.uiActions ?? []);
        void this.offerAction(turn.pendingAction ?? null);
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

  private dropStream(id: string): void {
    this.messages.update((current) => current.filter((item) => item.id !== id));
  }

  /**
   * Llegó el turno entero: lo pintado se cambia por el mensaje de verdad, con
   * su id del backend, para que el historial no lo duplique al recargar.
   */
  private settleTurn(bubble: string, turn: AssistantTurnResponse): void {
    this.sending.set(false);
    this.dropStream(bubble);
    this.pushAssistant(turn.assistantMessage);
    void this.handleUiActions(turn.uiActions ?? []);
    void this.offerAction(turn.pendingAction ?? null);
  }

  /**
   * Lo que el asistente quiere escribir. Si el formulario está en pantalla (o
   * acaba de abrirlo con un `uiAction`), la mascota lo recorre y lo rellena
   * ella, y la acción del backend se retira: a partir de ahí manda la persona,
   * que revisa y guarda con el botón del propio formulario. Si no hay
   * formulario, se pide confirmación como siempre.
   */
  private async offerAction(action: AssistantPendingActionDto | null): Promise<void> {
    if (!action) {
      this.pendingAction.set(null);
      return;
    }

    const timing = this.fillTiming();

    // De quién es la escritura, antes de mirar lo que hay en pantalla: si es
    // de otro paciente, el formulario que está abierto es el de la ficha
    // equivocada y escribir en él guardaría las medidas de uno en la ficha de
    // otro.
    const patientId = await this.actionPatientId(action);
    if (patientId && patientId !== this.currentSubjectUserId()) {
      await this.goToForm(action.toolName, patientId);
    }

    let mounted = await this.fill.waitForTool(action.toolName, SURFACE_WAIT_MS);

    // Ni el formulario ni su botón están aquí: habrá que ir a su pantalla. La
    // propuesta NO trae navegación (el backend manda su `NAVIGATE` al aplicar,
    // ya confirmada la acción), así que si no va la mascota no va nadie, y
    // pedir "cambia el horario" desde el panel principal se quedaba siempre en
    // la tarjeta de confirmar.
    if (!mounted && !this.fill.openerForTool(action.toolName)) {
      await this.goToForm(action.toolName, patientId ?? this.subjectPatientId());
      mounted = await this.fill.waitForTool(action.toolName, SURFACE_WAIT_MS);
    }

    // No está en pantalla, pero esta pantalla sabe abrirlo: la mascota va hasta
    // el botón y lo pulsa ella. Sin esto, pedir una medición con el diálogo
    // cerrado se quedaba siempre en la tarjeta de confirmar.
    if (!mounted) {
      const opener = this.fill.openerForTool(action.toolName);
      if (opener) {
        this.closePanel();
        this.fill.begin();
        try {
          if (await playOpen(opener, timing, this.fill)) {
            mounted = await this.fill.waitForTool(action.toolName, OPENED_SURFACE_WAIT_MS);
          }
        } finally {
          // Si no llegó a abrirse, la mascota vuelve a su sitio; si sí, el
          // relleno retoma el viaje justo después, sin soltarla.
          if (!mounted) this.fill.end();
        }
      }
    }

    const values = mounted ? matchPreview(mounted.surface, action.preview) : [];
    if (mounted) this.warnPreviewDrift(action, mounted.surface);
    if (!mounted || values.length === 0) {
      this.pendingAction.set(action);
      return;
    }

    // Se retira antes de escribir: lo que vale es lo que quede en el
    // formulario, y una acción viva en el backend podría escribir lo mismo otra vez.
    this.rejectQuietly(action);
    this.closePanel();
    const report = await playFill(mounted.surface, mounted.access, values, this.fill, timing);

    if (report.written.length === 0) {
      this.pushAssistantText(this.transloco.translate('assistant.fill_failed'));
      return;
    }
    this.mood.feel('cheer');
    this.mood.say({
      text: this.transloco.translate('assistant.fill_done', { count: String(report.written.length) }),
      tone: 'celebrate',
    });
    this.pushAssistantText(this.transloco.translate('assistant.fill_review'));
  }

  /**
   * El formulario está en pantalla y el backend nombra campos que no reconoce.
   *
   * A la persona no se le dice nada —la tarjeta de confirmar sigue haciendo su
   * trabajo—, pero sin esto el contrato se rompe en silencio y nadie se entera
   * hasta que un nutricionista nota que la mascota ha dejado de rellenar. Los
   * nombres están fijados en `doc/assistant-frontend.md` §6.
   */
  private warnPreviewDrift(action: AssistantPendingActionDto, surface: FillSurface): void {
    const orphans = unmatchedPreview(surface, action.preview);
    if (orphans.length === 0) return;

    const total = action.preview.filter((item) => item.value !== '').length;
    const scope = orphans.length === total ? 'ninguno' : `${orphans.length} de ${total}`;
    console.warn(
      `[mascota] "${action.toolName}" → formulario "${surface.id}": no reconoce ${scope} de los campos del preview.`,
      `Sin reconocer: ${orphans.join(', ')}.`,
      'El contrato de nombres está en doc/assistant-frontend.md §6.',
    );
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
        // (`doc/assistant-frontend.md` §5).
        void this.handleUiActions(response.uiActions ?? []);
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

  /**
   * `uiActions` no son rutas: se traduce `screen` contra una lista blanca.
   * Cualquier pantalla o acción desconocida se ignora.
   */
  private async handleUiActions(actions: AssistantUiActionDto[]): Promise<void> {
    // De paso se apunta de quién habla el backend: `params.patientId` es el
    // único sitio del contrato por el que el paciente activo llega hoy al
    // frontend (`doc/assistant-frontend.md` §4).
    for (const action of actions) {
      const patientId = action.params?.['patientId'];
      if (typeof patientId === 'string' && patientId !== '') this.activePatientId.set(patientId);
    }

    // La navegación primero, y una sola: cambia la pantalla debajo de las
    // demás, así que abrir un formulario o señalar un campo sólo tiene sentido
    // una vez que se ha llegado.
    for (const action of actions) {
      if (action.type !== 'NAVIGATE') continue;
      const route = this.routeFor(action);
      if (!route) continue;

      this.closePanel();
      await this.router.navigate(route.commands, { queryParams: route.queryParams });
      break;
    }

    // Y después TODAS las demás, no la primera: el backend manda el aviso y la
    // navegación en el mismo turno (`doc/assistant-frontend.md` §5).
    for (const action of actions) {
      switch (action.type) {
        case 'TOAST':
          this.showToast(action.params ?? {});
          break;
        // Abrir un formulario sin escribir en él ("ábreme una medición").
        case 'OPEN_DIALOG':
          await this.openDialog(action.target);
          break;
        // Señalar un campo mientras lo explica.
        case 'HIGHLIGHT':
          await this.highlightField(action.target);
          break;
        default:
          // `NAVIGATE` ya está, y lo desconocido se ignora en silencio.
          break;
      }
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

  /**
   * Señala un campo de un formulario que esté en pantalla. Si no hay ninguno
   * que se llame así, se ignora como cualquier otro `target` desconocido.
   */
  private async highlightField(target: string | undefined): Promise<void> {
    if (!target) return;
    const found = this.fill.fieldNamed(target);
    if (!found) return;

    this.closePanel();
    await playHighlight(found.surface, found.field, this.fillTiming(), this.fill);
  }

  /** Quien no quiera movimiento ve lo mismo, pero sin viaje ni tecleo. */
  private fillTiming(): FillTiming {
    return matchMedia('(prefers-reduced-motion: reduce)').matches ? STILL_TIMING : DEFAULT_FILL_TIMING;
  }

  /**
   * Va a la pantalla donde se rellena esa tool, si la mascota sabe cuál es.
   * Espera a que la página monte, porque lo siguiente es buscar allí el
   * formulario o el botón que lo abre.
   */
  private async goToForm(toolName: string, patientId: string | null): Promise<void> {
    const known = routeForTool(toolName);
    if (!known) return;
    const route = resolveFillRoute(known, patientId);
    if (!route) return;

    const url = this.router.createUrlTree(route.commands, { queryParams: route.queryParams });
    if (this.router.isActive(url, { paths: 'exact', queryParams: 'subset', fragment: 'ignored', matrixParams: 'ignored' })) {
      return;
    }

    this.closePanel();
    await this.router.navigate(route.commands, { queryParams: route.queryParams });
  }

  /** El paciente del que va la conversación: el que diga el backend o, si no, el de la ficha abierta. */
  private subjectPatientId(): string | null {
    return this.activePatientId() ?? this.session()?.subjectUserId ?? this.currentSubjectUserId();
  }

  /**
   * De quién es esta escritura. Sólo para las tools que se rellenan en una
   * ficha; para las del centro no hay paciente y devuelve `null`.
   *
   * Se mira en este orden, de lo más fiable a lo menos:
   *
   * 1. Lo que trae la propia propuesta. El backend lo tiene (lo comprueba al
   *    confirmar) y es lo único que no se puede quedar viejo.
   * 2. El paciente activo que ya conocíamos (de abrir la sesión o de un
   *    `uiAction` anterior).
   * 3. Preguntándoselo al backend: si la persona nombró a alguien, se habrá
   *    fijado con `set_active_patient` después de crear la sesión y nuestra
   *    copia no se ha enterado.
   * 4. La ficha que esté abierta, como siempre.
   */
  private async actionPatientId(action: AssistantPendingActionDto): Promise<string | null> {
    if (!routeForTool(action.toolName)?.needsPatient) return null;

    const stated = action.subjectUserId ?? action.patientId ?? null;
    if (stated) {
      this.activePatientId.set(stated);
      return stated;
    }

    const known = this.activePatientId() ?? this.session()?.subjectUserId ?? null;
    if (known) return known;

    return (await this.refreshActivePatient()) ?? this.currentSubjectUserId();
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

  /** Lleva a la mascota hasta el botón que abre ese formulario y lo pulsa. */
  private async openDialog(target: string | undefined): Promise<void> {
    if (!target) return;
    const opener = this.fill.openerFor(target);
    if (!opener) return;

    const timing = this.fillTiming();
    this.closePanel();
    this.fill.begin();
    try {
      await playOpen(opener, timing, this.fill);
    } finally {
      this.fill.end();
    }
  }

  /**
   * El asistente es para nutricionistas: las pantallas de paciente se abren
   * siempre dentro de su ficha (`/users/:id`). Las heredadas sin `patientId`
   * caen en la sección global equivalente.
   */
  private routeFor(action: AssistantUiActionDto): { commands: string[]; queryParams?: Record<string, string> } | null {
    const params = action.params ?? {};
    const patientId = typeof params['patientId'] === 'string' ? params['patientId'] : null;
    const patientRoute = patientId ? ['/users', patientId] : null;

    switch (action.screen) {
      case 'PATIENTS': {
        // `find_patient` manda a quién busca: el listado abre ya filtrado, que
        // es lo que la persona vería al teclearlo ella.
        const query = typeof params['query'] === 'string' ? params['query'].trim() : '';
        return query === ''
          ? { commands: ['/patients'] }
          : { commands: ['/patients'], queryParams: { q: query } };
      }
      case 'AGENDA':
      case 'APPOINTMENTS':
      case 'PATIENT_APPOINTMENTS':
        return { commands: ['/appointments'] };
      case 'DASHBOARD':
        return { commands: ['/dashboard'] };
      // Ajustes es maestro-detalle: las secciones no tienen ruta propia, así
      // que se abren con la pestaña puesta en los query params.
      case 'MENUS': {
        const query = typeof params['query'] === 'string' ? params['query'].trim() : '';
        return query === ''
          ? { commands: ['/menus'] }
          : { commands: ['/menus'], queryParams: { q: query } };
      }
      case 'SHOPPING_LIST':
        return { commands: ['/shopping-lists'] };
      case 'EVOLUTION':
        return { commands: ['/evolution'] };
      case 'REVENUE':
        return { commands: ['/revenue'] };
      case 'STAFF':
        return { commands: ['/staff'] };
      case 'SETTINGS':
        return { commands: ['/settings'] };
      case 'SETTINGS_BRANDING':
        return { commands: ['/settings'], queryParams: { tab: 'branding' } };
      case 'SETTINGS_SCHEDULES':
        return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'schedules' } };
      case 'SETTINGS_ASSIGNMENTS':
        return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'assignments' } };
      case 'SETTINGS_HOLIDAYS':
        return { commands: ['/settings'], queryParams: { tab: 'schedules', section: 'holidays' } };
      case 'PATIENT_PROFILE':
      case 'PROFILE':
      case 'ANAMNESIS':
        return patientRoute
          ? { commands: patientRoute, queryParams: { tab: 'patient_profile' } }
          : { commands: ['/dashboard'] };
      case 'PATIENT_MEASUREMENTS':
      case 'MEASUREMENTS':
        return patientRoute
          ? { commands: patientRoute, queryParams: { tab: 'measurements' } }
          : { commands: ['/dashboard'] };
      case 'PATIENT_MENU':
        return patientRoute
          ? { commands: patientRoute, queryParams: { tab: 'menus' } }
          : { commands: ['/dashboard'] };
      case 'MENU':
        return patientRoute
          ? { commands: patientRoute, queryParams: { tab: 'menus' } }
          : { commands: ['/menus'] };
      case 'DIARY':
        return patientRoute
          ? { commands: patientRoute, queryParams: { tab: 'menus' } }
          : { commands: ['/dashboard'] };
      default:
        return null;
    }
  }

  // ── Mensajes y errores ──────────────────────────────────────────────

  private pushUser(content: string): void {
    this.messages.update((current) => [
      ...current,
      { id: this.nextLocalId(), role: 'USER', content, createdAt: new Date().toISOString() },
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
      createdAt: message.createdAt,
    };
  }

  /** Traduce el código estable del backend; si no hay clave, usa el detalle. */
  /**
   * Si la sesión abierta ya no sirve para la ficha que se está mirando. Una
   * sesión general sobre un paciente denegado sí sirve: es lo mejor que el
   * backend nos deja tener ahí.
   */
  private isStaleFor(session: AssistantSessionDto, subjectUserId: string | null): boolean {
    if ((session.subjectUserId ?? null) === subjectUserId) return false;
    return !(subjectUserId !== null && this.deniedSubjects.has(subjectUserId) && !session.subjectUserId);
  }

  private errorMessage(error: HttpErrorResponse): string {
    const code = problemDetailCode(error);
    if (code) {
      const key = `errors.${code.replace(/^error\./, '')}`;
      const translated = this.transloco.translate(key);
      if (translated && translated !== key) return translated;
    }
    return problemDetailMessage(error) ?? this.transloco.translate('errors.unexpected');
  }

  /** Cierra la sesión en el backend sin bloquear la UI. */
  private closeRemoteSession(session: AssistantSessionDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;
    this.api.closeSession(tenantId, session.sessionId).subscribe({ error: () => undefined });
  }

  private resetConversation(closePanel: boolean): void {
    this.session.set(null);
    this.activePatientId.set(null);
    this.messages.set([]);
    this.pendingAction.set(null);
    this.consentRequired.set(false);
    this.historyLoadedFor = null;
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
  return error.status === 403 && problemDetailCode(error) === 'error.permission_denied';
}
