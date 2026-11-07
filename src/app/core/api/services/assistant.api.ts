import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpEventType, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { IGNORE_FORBIDDEN, IGNORE_NOT_FOUND, SILENT_ERROR } from '../../http/error.interceptor';
import {
  AssistantActionResponse,
  AssistantConfigDto,
  AssistantMessagePageDto,
  AssistantAttachmentDto,
  AssistantMilestoneDto,
  AssistantPetDto,
  AssistantPreferencesDto,
  AssistantSessionDto,
  AssistantStreamEvent,
  AssistantTurnResponse,
  AssistantUserLookDto,
  ConfirmAssistantActionRequest,
  CreateAssistantSessionRequest,
  UpdateAssistantConfigRequest,
  UpdateAssistantPreferencesRequest,
  UpdateAssistantUserLookRequest,
} from '../models/assistant.model';
import { parseFrame, scanFrames } from './assistant-stream';

/**
 * API del asistente. Todas las llamadas son **silenciosas** para el
 * `errorInterceptor`: la mascota muestra los errores dentro del panel, con el
 * código (`error.assistant_*`) traducido, en vez de un toast global.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly configService = inject(ConfigService);
  private readonly http = inject(HttpClient);

  private get baseUrl(): string {
    return this.configService.apiUrl;
  }

  private endpoint(tenantId: string): string {
    return `${this.baseUrl}/tenant/${tenantId}/assistant`;
  }

  /**
   * La mascota pinta sus propios errores: sin toast, sin `not-authorized` por
   * un 403 de negocio (IA apagada, consentimiento…) y sin 404 genéricos.
   */
  private get silent(): HttpContext {
    return new HttpContext()
      .set(SILENT_ERROR, true)
      .set(IGNORE_FORBIDDEN, true)
      .set(IGNORE_NOT_FOUND, true);
  }

  getConfig(tenantId: string): Observable<AssistantConfigDto> {
    return this.http.get<AssistantConfigDto>(`${this.endpoint(tenantId)}/config`, {
      context: this.silent,
    });
  }

  /** Requiere `MANAGE_TENANT`. El toast global se mantiene; el 403 no expulsa. */
  updateConfig(tenantId: string, request: UpdateAssistantConfigRequest): Observable<AssistantConfigDto> {
    return this.http.put<AssistantConfigDto>(`${this.endpoint(tenantId)}/config`, request, {
      context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true),
    });
  }

  /** Mascotas SVG empaquetadas, disponibles para cualquier tenant. */
  listPets(tenantId: string): Observable<AssistantPetDto[]> {
    return this.http.get<AssistantPetDto[]>(`${this.endpoint(tenantId)}/pets`, {
      context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true),
    });
  }

  /** Sube un SVG propio como avatar del centro. Requiere `MANAGE_TENANT`. */
  uploadAvatar(tenantId: string, file: File): Observable<AssistantConfigDto> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.put<AssistantConfigDto>(`${this.endpoint(tenantId)}/avatar`, formData, {
      context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true),
    });
  }

  /** Fija una mascota predefinida como avatar. Requiere `MANAGE_TENANT`. */
  selectPresetAvatar(tenantId: string, petId: string): Observable<AssistantConfigDto> {
    return this.http.put<AssistantConfigDto>(
      `${this.endpoint(tenantId)}/avatar/preset/${encodeURIComponent(petId)}`,
      {},
      { context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true) }
    );
  }

  /** Sube o reemplaza una animación Lottie. Requiere `MANAGE_TENANT`. */
  uploadAnimation(tenantId: string, animationName: string, file: File): Observable<AssistantConfigDto> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http.put<AssistantConfigDto>(
      `${this.endpoint(tenantId)}/animations/${encodeURIComponent(animationName)}`,
      formData,
      { context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true) }
    );
  }

  /** Elimina una animación Lottie. Requiere `MANAGE_TENANT`. */
  deleteAnimation(tenantId: string, animationName: string): Observable<AssistantConfigDto> {
    return this.http.delete<AssistantConfigDto>(
      `${this.endpoint(tenantId)}/animations/${encodeURIComponent(animationName)}`,
      { context: new HttpContext().set(IGNORE_FORBIDDEN, true).set(IGNORE_NOT_FOUND, true) }
    );
  }

  /**
   * Look procedural del usuario actual (contrato v2). Un backend antiguo
   * responde 404: el llamador cae a `localStorage` sin romper nada.
   */
  getLook(tenantId: string): Observable<AssistantUserLookDto> {
    return this.http.get<AssistantUserLookDto>(`${this.endpoint(tenantId)}/look`, {
      context: this.silent,
    });
  }

  /** Guarda el look del usuario actual. */
  updateLook(tenantId: string, request: UpdateAssistantUserLookRequest): Observable<AssistantUserLookDto> {
    return this.http.put<AssistantUserLookDto>(`${this.endpoint(tenantId)}/look`, request, {
      context: this.silent,
    });
  }

  /**
   * Sube el archivo a la sesión, **antes** de enviar el mensaje que lo lleva
   * (`§4.3`). Así el endpoint de mensajes sigue siendo JSON y el archivo se
   * sube una sola vez aunque el turno falle.
   */
  uploadAttachment(tenantId: string, sessionId: string, file: File): Observable<AssistantAttachmentDto> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<AssistantAttachmentDto>(
      `${this.endpoint(tenantId)}/sessions/${sessionId}/attachments`,
      form,
      { context: this.silent },
    );
  }

  /** Renueva la URL firmada de un adjunto cuando caduca (10 minutos). */
  attachmentUrl(tenantId: string, attachmentId: string): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(
      `${this.endpoint(tenantId)}/attachments/${attachmentId}/url`,
      { context: this.silent },
    );
  }

  /** Las preferencias de proactividad del usuario actual (`§5.1`). */
  getPreferences(tenantId: string): Observable<AssistantPreferencesDto> {
    return this.http.get<AssistantPreferencesDto>(`${this.endpoint(tenantId)}/preferences`, {
      context: this.silent,
    });
  }

  /** Reemplaza las preferencias enteras: hay que mandar siempre los cuatro campos. */
  updatePreferences(
    tenantId: string,
    request: UpdateAssistantPreferencesRequest,
  ): Observable<AssistantPreferencesDto> {
    return this.http.put<AssistantPreferencesDto>(
      `${this.endpoint(tenantId)}/preferences`,
      request,
      { context: this.silent },
    );
  }

  /** Las primeras veces de esta persona en este centro (`§5.2`). */
  getMilestones(tenantId: string): Observable<AssistantMilestoneDto[]> {
    return this.http.get<AssistantMilestoneDto[]>(`${this.endpoint(tenantId)}/milestones`, {
      context: this.silent,
    });
  }

  /** Deja dicho que ese hito ya se celebró. Idempotente. */
  markMilestoneCelebrated(tenantId: string, code: string): Observable<void> {
    return this.http.post<void>(
      `${this.endpoint(tenantId)}/milestones/${encodeURIComponent(code)}/celebrated`,
      {},
      { context: this.silent },
    );
  }

  /** Vuelve al look por defecto del tenant. */
  deleteLook(tenantId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/look`, {
      context: this.silent,
    });
  }

  /** Reutiliza la sesión activa del mismo usuario y subject. */
  createSession(tenantId: string, request: CreateAssistantSessionRequest): Observable<AssistantSessionDto> {
    return this.http.post<AssistantSessionDto>(`${this.endpoint(tenantId)}/sessions`, request, {
      context: this.silent,
    });
  }

  /**
   * La sesión viva tal y como está **ahora en el backend**.
   *
   * Hace falta por el paciente activo: cuando la persona dice "las medidas de
   * Frink" sin tener su ficha abierta, el backend lo resuelve con
   * `set_active_patient` y actualiza la sesión, pero la propuesta que llega no
   * trae el paciente por ningún lado (`AssistantPendingActionDto` no tiene
   * campo para él). Sin releer la sesión, el frontend no sabe de quién va la
   * medición y no puede ir a su ficha a rellenarla.
   *
   * Es de sólo lectura y silenciosa: si no hay sesión viva responde 404 y el
   * panel sigue como estaba.
   */
  latestSession(tenantId: string): Observable<AssistantSessionDto> {
    return this.http.get<AssistantSessionDto>(`${this.endpoint(tenantId)}/sessions/latest`, {
      context: this.silent,
    });
  }

  consent(tenantId: string, sessionId: string, accepted: boolean): Observable<void> {
    return this.http.post<void>(
      `${this.endpoint(tenantId)}/sessions/${sessionId}/consent`,
      { accepted },
      { context: this.silent }
    );
  }

  closeSession(tenantId: string, sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.endpoint(tenantId)}/sessions/${sessionId}`, {
      context: this.silent,
    });
  }

  sendMessage(
    tenantId: string,
    sessionId: string,
    content: string,
    attachmentId?: string | null,
  ): Observable<AssistantTurnResponse> {
    return this.http.post<AssistantTurnResponse>(
      `${this.endpoint(tenantId)}/sessions/${sessionId}/messages`,
      attachmentId ? { content, attachmentId } : { content },
      { context: this.silent }
    );
  }

  /**
   * El mismo envío, pero en streaming (`doc/contrato-api/assistant/assistant-frontend.md` §3.1).
   *
   * Va por `HttpClient` y no por `EventSource` por dos razones: `EventSource`
   * no sabe hacer POST con cuerpo, y por aquí pasan los interceptores, así que
   * el token se refresca como en el resto de llamadas.
   *
   * `reportProgress` da el texto acumulado según llega; se trocea en marcos y
   * se lleva la cuenta de lo consumido, porque un pedazo puede cortar un JSON
   * por la mitad.
   */
  streamMessage(
    tenantId: string,
    sessionId: string,
    content: string,
    attachmentId?: string | null,
  ): Observable<AssistantStreamEvent> {
    return new Observable<AssistantStreamEvent>((subscriber) => {
      let consumed = 0;

      const take = (buffer: string): void => {
        const scan = scanFrames(buffer, consumed);
        consumed = scan.consumed;
        for (const frame of scan.frames) {
          const event = parseFrame(frame);
          if (event) subscriber.next(event);
        }
      };

      const inner = this.http
        // Los dos endpoints leen el mismo cuerpo, así que el turno con adjunto
        // va por streaming como cualquier otro (`mascota-frontend.md` §4.1).
        .post(`${this.endpoint(tenantId)}/sessions/${sessionId}/messages/stream`, attachmentId ? { content, attachmentId } : { content }, {
          context: this.silent,
          headers: new HttpHeaders({ Accept: 'text/event-stream' }),
          observe: 'events',
          responseType: 'text',
          reportProgress: true,
        })
        .subscribe({
          next: (event) => {
            if (event.type === HttpEventType.DownloadProgress) take(event.partialText ?? '');
            // El último pedazo puede llegar sólo aquí, sin un progreso que lo traiga.
            else if (event.type === HttpEventType.Response) take(event.body ?? '');
          },
          error: (error: unknown) => subscriber.error(error),
          complete: () => subscriber.complete(),
        });

      return () => inner.unsubscribe();
    });
  }

  history(
    tenantId: string,
    sessionId: string,
    before?: string | null,
    limit = 30
  ): Observable<AssistantMessagePageDto> {
    let params = new HttpParams().set('limit', String(limit));
    if (before) params = params.set('before', before);

    return this.http.get<AssistantMessagePageDto>(
      `${this.endpoint(tenantId)}/sessions/${sessionId}/messages`,
      { params, context: this.silent }
    );
  }

  /**
   * Confirma una escritura. Se reenvía el `idempotencyKey` original: repetir la
   * llamada no duplica el efecto; con otra clave el backend responde `409`.
   */
  confirm(tenantId: string, actionId: string, idempotencyKey: string): Observable<AssistantActionResponse> {
    const request: ConfirmAssistantActionRequest = { idempotencyKey };
    return this.http.post<AssistantActionResponse>(
      `${this.endpoint(tenantId)}/pending-actions/${actionId}/confirm`,
      request,
      { context: this.silent }
    );
  }

  reject(tenantId: string, actionId: string): Observable<void> {
    return this.http.post<void>(
      `${this.endpoint(tenantId)}/pending-actions/${actionId}/reject`,
      {},
      { context: this.silent }
    );
  }
}
