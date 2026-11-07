import type { AssistantClientToolCall, AssistantClientToolDecl } from '../../../core/api/models/assistant.model';

/**
 * Lo que una herramienta de cliente le devuelve al modelo. El contenido lo
 * decide cada herramienta; por convenio lleva `ok` y, si algo falló, `reason`
 * (`assistant-contract` §3.2).
 */
export interface ToolResult {
  ok: boolean;
  reason?: ToolFailure | string;
  [key: string]: unknown;
}

/** Los motivos de fallo comunes a todas las herramientas. */
export type ToolFailure =
  /** El backend pidió una herramienta que esta pantalla ya no tiene. */
  | 'unknown_tool'
  /** La herramienta lanzó: un fallo nuestro, no de la persona. */
  | 'tool_error'
  /** La petición ya dio sus 30 pasos: hay que cerrar hablando. */
  | 'step_budget_exhausted';

export interface ToolContext {
  call: AssistantClientToolCall;
  /** Se aborta si la persona detiene el turno: la herramienta debe dejarlo donde esté. */
  signal: AbortSignal;
}

export type ToolRun = (args: Record<string, unknown>, context: ToolContext) => Promise<ToolResult>;

/** Una herramienta lista para declararse y ejecutarse. */
export interface ClientTool {
  decl: AssistantClientToolDecl;
  run: ToolRun;
  /** Si va en el catálogo de este turno. Sin esto, siempre. */
  offered?: () => boolean;
}
