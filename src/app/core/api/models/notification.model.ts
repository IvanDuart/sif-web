import { Page } from './page.model';

/**
 * Notificación del buzón persistente del usuario autenticado.
 *
 * No cuelga de un tenant: el buzón es de la persona y cada elemento trae su
 * `tenantId` para filtrar cuando se trabaja en varios centros.
 */
export interface NotificationDto {
  id: string;
  tenantId: string;
  /** Mismo catálogo que los eventos SSE (`APPOINTMENT_*`, `CHAT_MESSAGE`…). */
  type: string;
  title: string | null;
  body: string | null;
  /** Valores siempre en cadena, como en el canal SSE. */
  data: Record<string, string>;
  /** `null` mientras no se haya leído. */
  readAt: string | null;
  createdAt: string;
}

/** Resultado del listado: la página más el contador global de no leídas. */
export interface NotificationPage {
  page: Page<NotificationDto>;
  /** Cabecera `X-Unread-Count`; cuenta todas las no leídas, no solo la página. */
  unreadCount: number;
}
