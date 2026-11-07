import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import type { AssistantClientToolCall, ToolResultDelivery } from '../../../core/api/models/assistant.model';
import { AssistantService } from '../../../core/api/services/assistant.api';
import type { ToolResult } from './client-tool.model';
import { StepLimiter } from './step-limiter.service';
import { ToolRegistryService } from './tool-registry.service';
import { WriteWatchService } from './write-watch.service';

/** Lo más largo que se le cuenta al modelo de un fallo nuestro. */
const ERROR_MESSAGE_MAX = 200;

/**
 * Ejecuta lo que el backend pide en un `client_tool` y le devuelve el
 * resultado (`POST /runs/{runId}/tool-results`). La continuación del turno no
 * llega aquí, sino por el SSE ya abierto.
 *
 * El backend no manda una herramienta nueva sin tener la respuesta de la
 * anterior, así que hay una sola en curso. Si aun así llega otra, la anterior
 * se aborta: lo que vale es lo último que pidió.
 */
@Injectable({ providedIn: 'root' })
export class ToolRunnerService {
  private readonly api = inject(AssistantService);
  private readonly registry = inject(ToolRegistryService);
  private readonly steps = inject(StepLimiter);
  private readonly writes = inject(WriteWatchService);

  /** La herramienta que se está ejecutando, para la UI y para `X-Assistant-Write`. */
  readonly running = signal<{ name: string; callId: string; sessionId: string } | null>(null);

  private abort: AbortController | null = null;
  private readonly ran = new Set<string>();
  private sessionId = '';

  /**
   * Ejecuta la llamada y entrega el resultado.
   *
   * Devuelve `gone` si el turno ya no existe: el backend lo dio por perdido
   * (`404`), la entrega falló o la persona lo detuvo mientras se ejecutaba.
   * En cualquiera de esos casos no llegará nada más por el stream.
   */
  async handle(tenantId: string, call: AssistantClientToolCall): Promise<ToolResultDelivery> {
    this.abort?.abort();
    const controller = new AbortController();
    this.abort = controller;
    this.writes.reset();
    this.running.set({ name: call.name, callId: call.callId, sessionId: this.sessionId });

    const result = await this.execute(call, controller.signal);

    if (this.abort === controller) {
      this.abort = null;
      this.running.set(null);
    }
    if (controller.signal.aborted) return 'gone';

    try {
      return await firstValueFrom(this.api.postToolResult(tenantId, call.runId, call.callId, result));
    } catch {
      return 'gone';
    }
  }

  /**
   * Empieza un turno: lo que se ejecutó en el anterior deja de contar.
   *
   * Mientras conviva con el modelo antiguo, el `done` trae a veces una
   * propuesta que rellena el MISMO formulario que una herramienta ya rellenó
   * en este turno. Sin esto el formulario se escribiría dos veces, y la
   * segunda pisando lo que la persona pudo corregir en medio.
   */
  startTurn(sessionId: string): void {
    this.ran.clear();
    this.sessionId = sessionId;
  }

  /** Si esa herramienta ya se ejecutó en este turno. */
  alreadyRan(name: string): boolean {
    return this.ran.has(name);
  }

  /** Corta lo que se esté ejecutando sin contestar: el turno se ha detenido. */
  cancel(): void {
    this.abort?.abort();
    this.abort = null;
    this.running.set(null);
  }

  private async execute(call: AssistantClientToolCall, signal: AbortSignal): Promise<ToolResult> {
    // El backend cuenta cada llamada de cliente, también las que no se pueden
    // ejecutar; se cuenta igual para que «Paso n» no vaya por detrás.
    const allowed = this.steps.take();
    const run = this.registry.runFor(call.name);
    if (!run) return { ok: false, reason: 'unknown_tool' };
    // El backend aplica el mismo tope; esto evita ejecutar de más en el navegador.
    if (!allowed) return { ok: false, reason: 'step_budget_exhausted' };

    try {
      this.ran.add(call.name);
      return await run(call.args, { call, signal });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, reason: 'tool_error', message: message.slice(0, ERROR_MESSAGE_MAX) };
    }
  }
}
