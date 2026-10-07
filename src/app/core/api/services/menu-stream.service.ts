import { Injectable, inject } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { EventSourceMessage, fetchEventSource } from '@microsoft/fetch-event-source';
import Keycloak from 'keycloak-js';
import { ConfigService } from '../../config/config.service';

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

/** Espera antes de reintentar tras una caída, para no martillear al servidor. */
const RECONNECT_DELAY_MS = 3000;
/** Margen de validez con el que se renueva el JWT antes de (re)conectar. */
const TOKEN_MIN_VALIDITY_S = 30;

/**
 * Canal SSE con las actualizaciones en tiempo real de un menú.
 *
 * Notas de diseño:
 * - El `EventSource` nativo no permite mandar cabeceras, así que se usa
 *   `@microsoft/fetch-event-source`, que va sobre `fetch` y sí envía el
 *   `Authorization: Bearer`.
 * - La reconexión la gestiona este servicio con un bucle propio para poder
 *   **renovar el token** en cada intento: el servidor cierra el stream a los
 *   30 min y para entonces el JWT puede haber caducado. Por eso `onerror`
 *   relanza, desactivando el reintento interno de la librería.
 * - El servidor manda un `connected` al abrir y comentarios `keep-alive` cada
 *   20 s; los comentarios los descarta la librería y el `connected` se emite
 *   como `reason: 'CONNECTED'`.
 */
@Injectable({ providedIn: 'root' })
export class MenuStreamService {
  private readonly keycloak = inject(Keycloak);
  private readonly configService = inject(ConfigService);

  /**
   * Abre el stream del menú. Emite un valor por cada evento del backend
   * (incluido `CONNECTED`). Al cancelar la suscripción se cierra la conexión;
   * mientras tanto, si el servidor cierra, se reconecta solo.
   */
  streamMenu(
    menuId: string,
    tenantId: string,
    options: MenuStreamOptions = {}
  ): Observable<MenuUpdateEvent> {
    return new Observable<MenuUpdateEvent>((subscriber) => {
      const abortController = new AbortController();

      const sleep = (ms: number): Promise<void> =>
        new Promise((resolve) => {
          const timer = setTimeout(resolve, ms);
          abortController.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              resolve();
            },
            { once: true }
          );
        });

      const run = async (): Promise<void> => {
        while (!abortController.signal.aborted) {
          try {
            await this.connectOnce(menuId, tenantId, abortController.signal, subscriber, options);
          } catch (error) {
            if (abortController.signal.aborted) break;
            options.onConnectionChange?.(false);
            console.warn('[menu-stream] conexión SSE interrumpida, reintentando', error);
          }
          if (abortController.signal.aborted) break;
          await sleep(RECONNECT_DELAY_MS);
        }
      };

      void run();

      return () => abortController.abort();
    });
  }

  /** Una conexión completa: renueva token, abre el stream y lo consume hasta que cae. */
  private async connectOnce(
    menuId: string,
    tenantId: string,
    signal: AbortSignal,
    subscriber: Subscriber<MenuUpdateEvent>,
    options: MenuStreamOptions
  ): Promise<void> {
    const token = await this.freshToken();
    if (signal.aborted) return;
    if (!token) throw new Error('Sin token de acceso para el stream SSE');

    const url = `${this.configService.apiUrl}/tenant/${tenantId}/menu/${menuId}/stream`;

    await fetchEventSource(url, {
      method: 'GET',
      // En minúsculas a propósito: la librería comprueba `headers.accept` para
      // no duplicar el suyo.
      headers: {
        accept: 'text/event-stream',
        authorization: `Bearer ${token}`,
      },
      signal,
      // No cerrar el stream cuando la pestaña pasa a segundo plano.
      openWhenHidden: true,

      async onopen(response) {
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.includes('text/event-stream')) {
          throw new Error(`SSE no disponible (${response.status})`);
        }
        options.onConnectionChange?.(true);
      },

      onmessage(message: EventSourceMessage) {
        const event = toMenuUpdateEvent(message, menuId);
        if (event) subscriber.next(event);
      },

      onclose() {
        // Cierre limpio del servidor (timeout de 30 min): relanzar para que el
        // bucle externo renueve el token y vuelva a conectar.
        throw new Error('El servidor cerró el stream SSE');
      },

      onerror(error) {
        // Relanzar desactiva el reintento interno de la librería; el bucle
        // externo decide cuándo reconectar y con qué token.
        throw error;
      },
    });
  }

  /** Token válido para el próximo intento, renovándolo si caduca pronto. */
  private async freshToken(): Promise<string> {
    if (this.keycloak.authenticated) {
      await this.keycloak.updateToken(TOKEN_MIN_VALIDITY_S);
    }
    return this.keycloak.token ?? '';
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
