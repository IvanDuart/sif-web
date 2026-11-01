/** Mascota conversacional (`doc/mascota-frontend.md`). */

/**
 * Pantallas a las que el asistente puede navegar. Nunca rutas libres.
 *
 * El contrato de nutricionista (`doc/assistant-frontend.md`) añade las
 * pantallas `PATIENT_*`, `PATIENTS`, `AGENDA` y `DASHBOARD`; las heredadas se
 * mantienen por compatibilidad con respuestas antiguas.
 *
 * Las `SETTINGS_*` son la configuración del centro: abren Ajustes ya en su
 * pestaña, porque las secciones no tienen ruta propia.
 */
export type AssistantScreen =
  | 'PATIENTS'
  | 'AGENDA'
  | 'DASHBOARD'
  | 'MENUS'
  | 'SHOPPING_LIST'
  | 'EVOLUTION'
  | 'REVENUE'
  | 'STAFF'
  | 'SETTINGS'
  | 'SETTINGS_BRANDING'
  | 'SETTINGS_SCHEDULES'
  | 'SETTINGS_ASSIGNMENTS'
  | 'SETTINGS_HOLIDAYS'
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
  /**
   * Campos heredados del avatar por tenant. El contrato v2 los sustituye por
   * `defaultSkinId`; se mantienen opcionales para no romper backend antiguos.
   */
  avatarUrl?: string | null;
  avatarExpiresAt?: string | null;
  animations?: Record<string, string> | null;
  /** Skin procedural por defecto del centro (contrato v2). */
  defaultSkinId?: string | null;
  /** Qué personalización puede hacer cada usuario (contrato v2). */
  lookPolicy?: AssistantLookPolicyDto | null;
  greeting: string;
  suggestedPrompts: string[];
  consentRequired: boolean;
  consentText: string | null;
}

/** Política de personalización del look por usuario. */
export interface AssistantLookPolicyDto {
  allowUserLook: boolean;
  allowedSkinIds: string[];
  allowedAccessories: string[];
}

/** Look procedural elegido por el usuario actual. */
export interface AssistantUserLookDto {
  skinId: string | null;
  accessories: string[];
  updatedAt: string;
}

export interface UpdateAssistantUserLookRequest {
  skinId: string;
  accessories?: string[];
}

export interface UpdateAssistantConfigRequest {
  name?: string;
  persona?: string;
  tone?: string;
  /** Campos heredados: se mantienen para backend antiguos. */
  avatarStoredFileId?: string;
  animations?: Record<string, string>;
  /** Skin procedural por defecto del centro (contrato v2). */
  defaultSkinId?: string;
  lookPolicy?: AssistantLookPolicyDto;
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

/**
 * Mascota predefinida. El contrato v2 devuelve solo metadatos del catálogo
 * (`svgContent` desaparece); se mantiene opcional para backend antiguos.
 */
export interface AssistantPetDto {
  id: string;
  name: string;
  svgContent?: string;
  category?: string;
  order?: number;
  supports?: AssistantPetSupportsDto;
}

export interface AssistantPetSupportsDto {
  accessories: string[];
  expressions: string[];
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
  /**
   * De quién es la escritura, cuando es de paciente.
   *
   * El backend lo tiene (`AssistantPreparedAction.getSubjectUserId()`, que
   * comprueba al confirmar) pero hoy **no siempre lo serializa**. Sin él, una
   * propuesta pedida sin la ficha delante ("las medidas de Frink") no se puede
   * llevar a su formulario, porque el frontend no sabe de quién va. Ambos
   * nombres se aceptan: lo que llegue, se usa.
   */
  subjectUserId?: string | null;
  patientId?: string | null;
}

export interface AssistantUiActionDto {
  type: string;
  screen?: string;
  /** El formulario que abre un `OPEN_DIALOG`: `measurement`, `schedule`… */
  target?: string;
  params?: Record<string, unknown>;
}

/**
 * Lo que llega por el stream de un turno (`doc/assistant-frontend.md` §3.1).
 *
 * `done` trae el mismo objeto que el envío bloqueante, así que de él salen las
 * `uiActions` y la escritura pendiente igual que siempre: el stream sólo
 * cambia cómo se pinta el texto.
 */
export type AssistantStreamEvent =
  | { kind: 'delta'; text: string }
  | { kind: 'tool'; name: string }
  | { kind: 'done'; turn: AssistantTurnResponse }
  | { kind: 'error'; error: string; code: string | null };

export interface AssistantTurnResponse {
  assistantMessage: AssistantMessageDto;
  pendingAction: AssistantPendingActionDto | null;
  uiActions: AssistantUiActionDto[];
}

export interface AssistantActionResponse {
  /** `"APPLIED"`, no `"CONFIRMED"` (`doc/assistant-frontend.md` §5). */
  status: string;
  entityType: string | null;
  entityId: string | null;
  message: string | null;
  /**
   * Lo que hay que hacer en pantalla tras aplicar la acción: enseñar lo que se
   * acaba de crear, avisar. Opcional: si no viene, no se hace nada.
   */
  uiActions?: AssistantUiActionDto[];
}

export interface AssistantConsentRequest {
  accepted: boolean;
}

export interface ConfirmAssistantActionRequest {
  idempotencyKey: string;
}
