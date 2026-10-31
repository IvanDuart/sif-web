/** Mascota conversacional (`doc/mascota-frontend.md`). */

/**
 * Pantallas a las que el asistente puede navegar. Nunca rutas libres.
 *
 * El contrato de nutricionista (`doc/assistant-frontend.md`) añade las
 * pantallas `PATIENT_*`, `PATIENTS`, `AGENDA` y `DASHBOARD`; las heredadas se
 * mantienen por compatibilidad con respuestas antiguas.
 */
export type AssistantScreen =
  | 'PATIENTS'
  | 'AGENDA'
  | 'DASHBOARD'
  | 'PATIENT_PROFILE'
  | 'PATIENT_MENU'
  | 'PATIENT_MEASUREMENTS'
  | 'PATIENT_APPOINTMENTS'
  | 'PROFILE'
  | 'ANAMNESIS'
  | 'MEASUREMENTS'
  | 'MENU'
  | 'APPOINTMENTS'
  | 'DIARY';

export interface AssistantConfigDto {
  enabled: boolean;
  apiKeyConfigured: boolean;
  name: string;
  /** El OpenAPI no lo lista, pero `PUT /config` lo acepta. */
  persona?: string | null;
  tone: string;
  /** Avatar configurado por el centro; tiene prioridad sobre el de por defecto. */
  avatarUrl: string | null;
  avatarExpiresAt: string | null;
  animations: Record<string, string> | null;
  greeting: string;
  suggestedPrompts: string[];
  consentRequired: boolean;
  consentText: string | null;
}

export interface UpdateAssistantConfigRequest {
  name?: string;
  persona?: string;
  tone?: string;
  avatarStoredFileId?: string;
  animations?: Record<string, string>;
  enabled?: boolean;
  consentText?: string;
}

export interface CreateAssistantSessionRequest {
  subjectUserId?: string | null;
  screen?: AssistantScreen;
}

export interface AssistantSessionDto {
  sessionId: string;
  consentRequired: boolean;
  greeting: string;
  expiresAt: string;
  subjectUserId: string | null;
}

/** Mascota predefinida empaquetada en el backend. */
export interface AssistantPetDto {
  id: string;
  name: string;
  svgContent: string;
}

export interface AssistantMessageDto {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM' | string;
  content: string;
  createdAt: string;
}

export interface AssistantMessagePageDto {
  /** Del más reciente al más antiguo, igual que el chat. */
  items: AssistantMessageDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface AssistantActionPreviewItem {
  field: string;
  label: string;
  value: string;
}

export interface AssistantPendingActionDto {
  id: string;
  toolName: string;
  summary: string;
  preview: AssistantActionPreviewItem[];
  /** Se reenvía **exactamente igual** al confirmar. */
  idempotencyKey: string;
  expiresAt: string;
}

export interface AssistantUiActionDto {
  type: string;
  screen?: string;
  params?: Record<string, unknown>;
}

export interface AssistantTurnResponse {
  assistantMessage: AssistantMessageDto;
  pendingAction: AssistantPendingActionDto | null;
  uiActions: AssistantUiActionDto[];
}

export interface AssistantActionResponse {
  status: string;
  entityType: string | null;
  entityId: string | null;
  message: string | null;
}

export interface AssistantConsentRequest {
  accepted: boolean;
}

export interface ConfirmAssistantActionRequest {
  idempotencyKey: string;
}
