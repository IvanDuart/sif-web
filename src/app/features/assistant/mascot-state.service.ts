import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';

import { AssistantService } from '../../core/api/services/assistant.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { problemDetailCode, problemDetailMessage } from '../../core/http/error.interceptor';
import { MascotLookService } from './mascot/mascot-look.service';
import { MascotMoodService } from './mascot/mascot-mood.service';
import { DEFAULT_FILL_TIMING, STILL_TIMING, playFill, playOpen } from './mascot/fill/animated-fill';
import { matchPreview } from './mascot/fill/descriptor';
import { MascotFillService } from './mascot/fill/mascot-fill.service';
import type { MascotMode } from './mascot/mascot-life.service';
import {
  AssistantActionResponse,
  AssistantConfigDto,
  AssistantMessageDto,
  AssistantPendingActionDto,
  AssistantScreen,
  AssistantSessionDto,
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
  private readonly fill = inject(MascotFillService);

  readonly config = signal<AssistantConfigDto | null>(null);
  readonly configLoaded = signal(false);
  readonly open = signal(false);
  /** El armario, montado por el launcher para que cubra la página entera. */
  readonly wardrobeOpen = signal(false);

  readonly session = signal<AssistantSessionDto | null>(null);
  readonly consentRequired = signal(false);
  readonly messages = signal<MascotMessage[]>([]);
  readonly pendingAction = signal<AssistantPendingActionDto | null>(null);
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
    if (session && (session.subjectUserId ?? null) !== this.currentSubjectUserId()) {
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

    this.sessionRequest = this.api
      // Si el nutricionista abre el asistente desde una ficha, esa ficha es el
      // paciente activo. Sin ficha, arranca sin paciente y el backend lo fija
      // después con `set_active_patient` cuando la tarea lo requiere.
      .createSession(tenantId, {
        subjectUserId: this.currentSubjectUserId(),
        screen: this.currentScreen(),
      })
      .pipe(
        tap((session) => {
          this.session.set(session);
          this.consentRequired.set(session.consentRequired);
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

      this.api.sendMessage(tenantId, session.sessionId, text).subscribe({
        next: (turn) => {
          this.sending.set(false);
          this.pushAssistant(turn.assistantMessage);
          this.handleUiActions(turn.uiActions ?? []);
          void this.offerAction(turn.pendingAction ?? null);
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.handleTurnError(error);
        },
      });
    });
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

    const timing = matchMedia('(prefers-reduced-motion: reduce)').matches ? STILL_TIMING : DEFAULT_FILL_TIMING;
    let mounted = await this.fill.waitForTool(action.toolName, SURFACE_WAIT_MS);

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
      this.consentRequired.set(false);
      this.historyLoadedFor = null;
      this.pendingAction.set(null);
    }
    if (code === 'error.assistant_consent_required') {
      this.consentRequired.set(true);
    }

    this.pushSystem(this.errorMessage(error));
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
    return 'DASHBOARD';
  }

  // ── Navegación controlada ───────────────────────────────────────────

  /**
   * `uiActions` no son rutas: se traduce `screen` contra una lista blanca.
   * Cualquier pantalla o acción desconocida se ignora.
   */
  private handleUiActions(actions: AssistantUiActionDto[]): void {
    for (const action of actions) {
      if (action.type !== 'NAVIGATE') continue;
      const route = this.routeFor(action);
      if (!route) continue;

      this.closePanel();
      void this.router.navigate(route.commands, { queryParams: route.queryParams });
      return;
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
      case 'PATIENTS':
        return { commands: ['/patients'] };
      case 'AGENDA':
      case 'APPOINTMENTS':
      case 'PATIENT_APPOINTMENTS':
        return { commands: ['/appointments'] };
      case 'DASHBOARD':
        return { commands: ['/dashboard'] };
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
