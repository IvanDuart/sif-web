import { Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import Keycloak from 'keycloak-js';

import { ConfigService } from '../../config/config.service';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { sseStream } from './sse-stream';

/**
 * Los ocho avisos del backend (`doc/citas_pacientes_onesignal.md` §3bis). Son
 * los mismos que recibe la app móvil por push; aquí llegan por SSE.
 */
export type AppNotificationType =
  | 'APPOINTMENT_REQUESTED'
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_RESCHEDULED'
  | 'APPOINTMENT_COMPLETED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_NO_SHOW'
  | 'APPOINTMENT_REMINDER'
  | 'CALENDAR_NOTE_REMINDER';

/**
 * Datos estructurados del aviso. **Todos los valores son cadenas**, incluidos
 * los que parecen fecha o enumerado: el parseo es cosa del cliente. El `type`
 * no se estrecha al union para que un tipo nuevo del backend no rompa el
 * parseo; los consumidores comparan contra los que conocen.
 */
export interface AppNotificationData {
  type: AppNotificationType | string;
  tenantId?: string;
  /** `appointmentId` o `noteId`, según el tipo. */
  entityId?: string;
  /** Inicio de la entidad, ISO 8601 UTC. Puede no ser hoy. */
  startTime?: string;
  /** Sólo en notas de calendario. */
  noteType?: 'REMINDER' | 'TIME_BLOCK';
}

/** Aviso tal y como viaja por el canal: el texto ya viene traducido. */
export interface AppNotification {
  title: string | null;
  body: string | null;
  data: AppNotificationData;
  occurredAt: string;
}

/**
 * Canal SSE con los avisos del usuario conectado
 * (`doc/sse-notificaciones-frontend.md`).
 *
 * Tres cosas que lo diferencian del canal de menú:
 *
 * - **No lleva `tenantId` en la ruta**: los avisos son de una *persona*, así
 *   que hay una sola conexión por sesión. El `Shell` la abre y los demás se
 *   suscriben a `notifications$`; no hay una conexión por pantalla.
 * - **El evento ya trae el texto que se muestra**, no es una señal para
 *   recargar. `data` sigue sirviendo para refrescar la vista afectada.
 * - **Es efímero**: lo emitido con la web cerrada se pierde y no hay historial
 *   ni replay. Por eso `reconnected$` avisa tras recuperar la conexión, para
 *   que las pantallas abiertas se refresquen por REST y tapen el hueco.
 *
 * Los avisos de otro centro se descartan: el canal es multicentro pero la
 * sesión no (cambiar de tenant recarga la página), así que un aviso de otro
 * tenant no es accionable desde aquí.
 */
@Injectable({ providedIn: 'root' })
export class NotificationStreamService {
  private readonly keycloak = inject(Keycloak);
  private readonly configService = inject(ConfigService);
  private readonly tenantCtx = inject(TenantContextService);

  private readonly notifications = new Subject<AppNotification>();
  private readonly reconnected = new Subject<void>();

  private subscription: Subscription | null = null;
  /** Para distinguir la primera conexión de una reconexión tras una caída. */
  private hasConnected = false;

  /** `true` mientras el canal está abierto. Para un indicador de "en directo". */
  readonly connected = signal(false);

  /** Avisos dirigidos al usuario, ya filtrados al tenant activo. */
  readonly notifications$: Observable<AppNotification> = this.notifications.asObservable();

  /**
   * Emite al recuperar la conexión tras perderla (no en la primera). Durante
   * ese hueco se pueden haber perdido avisos: toca refrescar por REST.
   */
  readonly reconnected$: Observable<void> = this.reconnected.asObservable();

  /** Abre el canal. Idempotente: llamarlo dos veces no abre dos conexiones. */
  connect(): void {
    if (this.subscription) return;

    this.subscription = sseStream<AppNotification>({
      url: `${this.configService.apiUrl}/notifications/stream`,
      keycloak: this.keycloak,
      label: 'notification-stream',
      parse: toNotification,
      onConnectionChange: (connected) => {
        this.connected.set(connected);
        if (!connected) return;
        if (this.hasConnected) {
          this.reconnected.next();
        }
        this.hasConnected = true;
      },
    }).subscribe({
      next: (notification) => {
        if (this.belongsToCurrentTenant(notification)) {
          this.notifications.next(notification);
        }
      },
      // `404`: el JWT es válido pero no hay usuario detrás. Reintentar no
      // arreglaría nada, así que el canal se queda cerrado.
      error: () => this.connected.set(false),
    });
  }

  disconnect(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;
    this.hasConnected = false;
    this.connected.set(false);
  }

  /** Un aviso sin `tenantId` (como `CONNECTED`) se deja pasar. */
  private belongsToCurrentTenant(notification: AppNotification): boolean {
    const tenantId = notification.data?.tenantId;
    return !tenantId || tenantId === this.tenantCtx.currentTenantId();
  }
}

/**
 * Traduce un mensaje SSE a un aviso, o `null` si no lo es. El evento
 * `connected` de apertura no es un aviso: sólo confirma el canal, y el estado
 * ya lo refleja `onConnectionChange`.
 */
function toNotification(message: EventSourceMessage): AppNotification | null {
  if (message.event !== 'notification') return null;

  try {
    return JSON.parse(message.data) as AppNotification;
  } catch (error) {
    console.error('[notification-stream] payload SSE inválido', message.data, error);
    return null;
  }
}
