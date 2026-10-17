import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EventSourceMessage } from '@microsoft/fetch-event-source';
import Keycloak from 'keycloak-js';
import { ConfigService } from '../../config/config.service';
import { sseStream } from './sse-stream';

/** Motivos que publica el backend en cada evento `menu-update`. */
export type MenuUpdateReason =
  | 'CONNECTED'
  | 'MENU_UPDATED'
  | 'MENU_DELETED'
  | 'MEAL_CREATED'
  | 'MEAL_UPDATED'
  | 'MEAL_DELETED'
  | 'DAY_COPIED';

/**
 * Señal que emite el backend cuando cambia un menú. **No** trae la dieta: sólo
 * el `menuId` y el motivo, para que el frontend vuelva a pedirla por REST.
 */
export interface MenuUpdateEvent {
  tenantId: string | null;
  menuId: string;
  reason: MenuUpdateReason;
  occurredAt: string;
}

export interface MenuStreamOptions {
  /**
   * Estado de la conexión: `true` al abrir (o reabrir) el stream, `false` al
   * perderla. Útil para un indicador de "en directo".
   */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Canal SSE con las actualizaciones en tiempo real de un menú.
 *
 * La mecánica del transporte (token fresco en cada reconexión, latidos,
 * reintentos) vive en `sse-stream.ts`, compartida con el canal de
 * notificaciones. Aquí sólo queda la URL y la forma del evento.
 *
 * El servidor manda un `connected` al abrir, que se emite como
 * `reason: 'CONNECTED'`.
 */
@Injectable({ providedIn: 'root' })
export class MenuStreamService {
  private readonly keycloak = inject(Keycloak);
  private readonly configService = inject(ConfigService);

  /**
   * Abre el stream del menú. Emite un valor por cada evento del backend
   * (incluido `CONNECTED`). Al cancelar la suscripción se cierra la conexión;
   * mientras tanto, si el servidor cierra, se reconecta solo. Si el backend
   * rechaza la suscripción (sin `VIEW_MENU` ni ser dueño del menú), el
   * observable falla en vez de reintentar sin fin.
   */
  streamMenu(
    menuId: string,
    tenantId: string,
    options: MenuStreamOptions = {}
  ): Observable<MenuUpdateEvent> {
    return sseStream<MenuUpdateEvent>({
      url: `${this.configService.apiUrl}/tenant/${tenantId}/menu/${menuId}/stream`,
      keycloak: this.keycloak,
      label: 'menu-stream',
      parse: (message) => toMenuUpdateEvent(message, menuId),
      onConnectionChange: options.onConnectionChange,
    });
  }
}

/** Traduce un mensaje SSE a un `MenuUpdateEvent`, o `null` si no interesa. */
function toMenuUpdateEvent(message: EventSourceMessage, menuId: string): MenuUpdateEvent | null {
  if (message.event === 'connected') {
    return { tenantId: null, menuId, reason: 'CONNECTED', occurredAt: new Date().toISOString() };
  }
  if (message.event !== 'menu-update') {
    return null;
  }
  try {
    return JSON.parse(message.data) as MenuUpdateEvent;
  } catch (error) {
    console.error('[menu-stream] payload SSE inválido', message.data, error);
    return null;
  }
}
