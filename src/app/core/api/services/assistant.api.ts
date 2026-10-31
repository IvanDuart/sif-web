import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { ConfigService } from '../../config/config.service';
import { IGNORE_FORBIDDEN, IGNORE_NOT_FOUND, SILENT_ERROR } from '../../http/error.interceptor';
import {
  AssistantActionResponse,
  AssistantConfigDto,
  AssistantMessagePageDto,
  AssistantPetDto,
  AssistantSessionDto,
  AssistantTurnResponse,
  AssistantUserLookDto,
  ConfirmAssistantActionRequest,
  CreateAssistantSessionRequest,
  UpdateAssistantConfigRequest,
  UpdateAssistantUserLookRequest,
} from '../models/assistant.model';

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

  sendMessage(tenantId: string, sessionId: string, content: string): Observable<AssistantTurnResponse> {
    return this.http.post<AssistantTurnResponse>(
      `${this.endpoint(tenantId)}/sessions/${sessionId}/messages`,
      { content },
      { context: this.silent }
    );
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
