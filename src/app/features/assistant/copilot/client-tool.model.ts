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
  | 'step_budget_exhausted'
  /** El formulario estaba cuando se declaró y ya no está al ejecutar. */
  | 'surface_gone'
  /** La persona dijo que no, o detuvo el turno mientras se le preguntaba. */
  | 'user_declined'
  /** El control que había que señalar o pulsar no está en pantalla. */
  | 'control_gone'
  /** Está, pero deshabilitado: pulsarlo no haría nada. */
  | 'control_disabled'
  /**
   * Al pulsar, la propia aplicación abrió su diálogo de confirmación. La
   * mascota NO lo atraviesa: esa decisión es de la persona.
   */
  | 'opened_dialog'
  /** El fragmento de texto que había que editar no aparece. */
  | 'not_found'
  /** Aparece más de una vez: editarlo sería elegir por la persona. */
  | 'ambiguous';

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
  /**
   * Termina de declararla con lo que hay en pantalla ahora: los ids de los
   * controles que se pueden señalar cambian con cada pantalla, y el modelo no
   * puede nombrar lo que no ha visto. El nombre no se toca, que es la clave
   * con la que luego se despacha.
   */
  refine?: (decl: AssistantClientToolDecl) => AssistantClientToolDecl;
}
