import { Observable, Subscriber } from 'rxjs';
import { EventSourceMessage, fetchEventSource } from '@microsoft/fetch-event-source';
import Keycloak from 'keycloak-js';

/** Espera antes de reintentar tras una caída, para no martillear al servidor. */
export const SSE_RECONNECT_DELAY_MS = 3000;
/** Margen de validez con el que se renueva el JWT antes de (re)conectar. */
const TOKEN_MIN_VALIDITY_S = 30;

/**
 * Respuestas en las que reintentar no cambiaría nada: no es un corte de red,
 * es que este usuario no puede abrir este canal (sin permiso sobre el recurso,
 * o un JWT válido que no corresponde a ningún usuario). Sin esta distinción el
 * bucle de reconexión pediría lo mismo cada 3 s para siempre.
 */
const FATAL_STATUSES = new Set([403, 404]);

/** Rechazo definitivo del servidor: el stream se cierra en vez de reintentar. */
export class SseFatalError extends Error {
  constructor(readonly status: number) {
    super(`SSE rechazado con ${status}`);
    this.name = 'SseFatalError';
  }
}

export interface SseStreamConfig<T> {
  /** URL absoluta del endpoint SSE. */
  url: string;
  keycloak: Keycloak;
  /** Prefijo de los avisos en consola, p. ej. `menu-stream`. */
  label: string;
  /** Traduce cada mensaje al valor a emitir, o `null` para descartarlo. */
  parse: (message: EventSourceMessage) => T | null;
  /**
   * Estado de la conexión: `true` al abrir (o reabrir) el stream, `false` al
   * perderla. Útil para un indicador de "en directo".
   */
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Canal SSE autenticado con reconexión propia.
 *
 * Notas de diseño, comunes a los dos canales del backend (menú y
 * notificaciones):
 * - El `EventSource` nativo no permite mandar cabeceras, así que se usa
 *   `@microsoft/fetch-event-source`, que va sobre `fetch` y sí envía el
 *   `Authorization: Bearer`.
 * - La reconexión se gestiona aquí, con un bucle propio, para poder **renovar
 *   el token** en cada intento: el servidor cierra el stream a los 30 min y
 *   para entonces el JWT puede haber caducado. Por eso `onerror` relanza,
 *   desactivando el reintento interno de la librería.
 * - El servidor manda un evento al abrir y comentarios `keep-alive` cada 20 s;
 *   los comentarios los descarta la librería.
 * - Las peticiones van por `fetch`, no por `HttpClient`: el `errorInterceptor`
 *   no las ve, así que los estados de error se tratan aquí.
 */
export function sseStream<T>(config: SseStreamConfig<T>): Observable<T> {
  return new Observable<T>((subscriber) => {
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
          await connectOnce(config, abortController.signal, subscriber);
        } catch (error) {
          if (abortController.signal.aborted) break;
          config.onConnectionChange?.(false);

          if (error instanceof SseFatalError) {
            subscriber.error(error);
            return;
          }

          console.warn(`[${config.label}] conexión SSE interrumpida, reintentando`, error);
        }
        if (abortController.signal.aborted) break;
        await sleep(SSE_RECONNECT_DELAY_MS);
      }
    };

    void run();

    return () => abortController.abort();
  });
}

/** Una conexión completa: renueva token, abre el stream y lo consume hasta que cae. */
async function connectOnce<T>(
  config: SseStreamConfig<T>,
  signal: AbortSignal,
  subscriber: Subscriber<T>
): Promise<void> {
  const token = await freshToken(config.keycloak);
  if (signal.aborted) return;
  if (!token) throw new Error('Sin token de acceso para el stream SSE');

  await fetchEventSource(config.url, {
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
      if (response.ok && contentType.includes('text/event-stream')) {
        config.onConnectionChange?.(true);
        return;
      }
      if (FATAL_STATUSES.has(response.status)) {
        throw new SseFatalError(response.status);
      }
      // El 401 entra aquí: el siguiente intento renueva el token antes de pedir.
      throw new Error(`SSE no disponible (${response.status})`);
    },

    onmessage(message: EventSourceMessage) {
      const value = config.parse(message);
      if (value !== null) subscriber.next(value);
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
async function freshToken(keycloak: Keycloak): Promise<string> {
  if (keycloak.authenticated) {
    await keycloak.updateToken(TOKEN_MIN_VALIDITY_S);
  }
  return keycloak.token ?? '';
}
