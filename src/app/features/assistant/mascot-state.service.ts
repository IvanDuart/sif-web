import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, catchError, finalize, of, shareReplay, tap } from 'rxjs';

import { AssistantService } from '../../core/api/services/assistant.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { problemDetailCode, problemDetailMessage } from '../../core/http/error.interceptor';
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

/**
 * Avatares por defecto. Se elige uno al azar por sesión de navegador; el avatar
 * configurado por el centro (`config.avatarUrl`) siempre tiene prioridad.
 */
const DEFAULT_AVATARS = [
  'pets/brocoli.svg',
  'pets/manzana.svg',
  'pets/semilla.svg',
  'pets/zanahoria.svg',
] as const;

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

  readonly config = signal<AssistantConfigDto | null>(null);
  readonly configLoaded = signal(false);
  readonly open = signal(false);

  readonly session = signal<AssistantSessionDto | null>(null);
  readonly consentRequired = signal(false);
  readonly messages = signal<MascotMessage[]>([]);
  readonly pendingAction = signal<AssistantPendingActionDto | null>(null);
  readonly sending = signal(false);
  readonly resolvingAction = signal(false);

  readonly enabled = computed(() => this.config()?.enabled === true);
  readonly name = computed(() => this.config()?.name?.trim() || 'Nuti');
  readonly greeting = computed(() => this.session()?.greeting || this.config()?.greeting || '');
  readonly suggestedPrompts = computed(() => this.config()?.suggestedPrompts ?? []);
  readonly consentText = computed(
    () => this.config()?.consentText?.trim() || this.transloco.translate('assistant.consent_default')
  );

  private readonly fallbackAvatar = DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
  private configTenantId: string | null = null;
  private loadingConfig = false;
  private sessionRequest: Observable<AssistantSessionDto | null> | null = null;
  private historyLoadedFor: string | null = null;
  private localId = 0;

  /** Avatar visible: el del centro si existe; si no, una mascota al azar. */
  readonly avatarSrc = computed(() => this.config()?.avatarUrl || this.fallbackAvatar);
  readonly fallbackSrc = computed(() => this.fallbackAvatar);

  /** Lottie opcional configurado por el centro. */
  readonly idleAnimation = computed(() => this.animationUrl('idle'));
  readonly thinkingAnimation = computed(() => this.animationUrl('thinking'));

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
        if (!config.enabled) this.open.set(false);
      },
      error: () => {
        // Sin configuración (o sin IA contratada) la mascota no se muestra.
        this.loadingConfig = false;
        this.config.set(null);
        this.configLoaded.set(true);
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
    if (!this.enabled()) return;
    if (this.open()) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  openPanel(): void {
    if (!this.enabled()) return;
    this.open.set(true);

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
          this.pendingAction.set(turn.pendingAction ?? null);
          this.handleUiActions(turn.uiActions ?? []);
        },
        error: (error: HttpErrorResponse) => {
          this.sending.set(false);
          this.handleTurnError(error);
        },
      });
    });
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
        this.pushAssistantText(
          response.message?.trim() || this.transloco.translate('assistant.action_applied')
        );
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

  /** El contrato declara `animations` como mapa libre; sólo aceptamos strings. */
  private animationUrl(key: string): string | null {
    const value = this.config()?.animations?.[key];
    return typeof value === 'string' && value.length > 0 ? value : null;
  }
}
