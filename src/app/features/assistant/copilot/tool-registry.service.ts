import { Injectable, inject, isDevMode } from '@angular/core';

import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import { MAX_TOOLS, cleanDescription, declProblem } from './catalog-rules';
import type { ClientTool, ToolRun } from './client-tool.model';
import { ScreenToolsService } from './screen-tools.service';

/**
 * Las herramientas que el navegador sabe ejecutar en la pantalla actual
 * (`assistant-contract` §3.2).
 *
 * El catálogo se manda en cada turno porque depende de la pantalla. Lo que el
 * backend no acepte lo descarta en silencio, así que aquí se comprueba con sus
 * mismas reglas y, en desarrollo, se avisa por consola de lo que no pasaría.
 */
@Injectable({ providedIn: 'root' })
export class ToolRegistryService {
  private readonly screen = inject(ScreenToolsService);
  private readonly tools = new Map<string, ClientTool>();
  private readonly warned = new Set<string>();

  /** Registra una herramienta; devuelve cómo quitarla. */
  register(tool: ClientTool): () => void {
    this.tools.set(tool.decl.name, tool);
    return () => {
      if (this.tools.get(tool.decl.name) === tool) this.tools.delete(tool.decl.name);
    };
  }

  /**
   * Lo que se declara en este turno: las herramientas registradas y las de los
   * formularios que hay montados, sin pasar de 40 y sin nada que el backend
   * fuera a descartar.
   */
  catalog(): AssistantClientToolDecl[] {
    const decls: AssistantClientToolDecl[] = [
      ...[...this.tools.values()]
        .filter((tool) => this.attempt(() => tool.offered?.() ?? true, false))
        .map((tool) => this.attempt(() => ({ ...(tool.refine?.(tool.decl) ?? tool.decl), name: tool.decl.name }), tool.decl)),
      ...this.attempt(() => this.screen.decls(), []),
    ].map((decl) => ({ ...decl, description: cleanDescription(decl.description) }));

    const valid = decls.filter((decl) => {
      const problem = declProblem(decl);
      if (problem) this.warn(decl.name, problem);
      return problem === null;
    });
    if (valid.length > MAX_TOOLS) this.warn('*', `${valid.length} herramientas; el backend se queda con ${MAX_TOOLS}`);
    return valid.slice(0, MAX_TOOLS);
  }

  /**
   * Cómo se ejecuta una herramienta, aunque no se haya declarado en este
   * turno: si el modelo la pide es que la tuvo delante, y contestar algo útil
   * es mejor que un `unknown_tool`.
   */
  runFor(name: string): ToolRun | null {
    const fixed = this.tools.get(name)?.run;
    if (fixed) return fixed;
    // Las de pantalla se resuelven ahora, no al declararse: entre que el
    // catálogo salió y el modelo llama, el diálogo puede haberse cerrado.
    return this.attempt(() => this.screen.runFor(name, { catalog: () => this.catalog() }), null);
  }

  /** Código de pantalla ajeno: si lanza, la herramienta no se ofrece y el turno sigue. */
  private attempt<T>(read: () => T, fallback: T): T {
    try {
      return read();
    } catch {
      return fallback;
    }
  }

  private warn(name: string, problem: string): void {
    if (!isDevMode() || this.warned.has(`${name}:${problem}`)) return;
    this.warned.add(`${name}:${problem}`);
    console.warn(`[mascota] el backend descartaría «${name}»: ${problem}`);
  }
}
