import { Injectable, inject, isDevMode } from '@angular/core';

import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MAX_TOOLS, cleanDescription, declProblem } from './catalog-rules';
import type { ClientTool, ToolRun } from './client-tool.model';
import { fillTools } from './schema';
import { ECHO_TOOL } from './tools/echo.run';

/** La clave de `localStorage` que declara las herramientas de formulario antes de que se puedan ejecutar. */
export const SCREEN_TOOLS_KEY = 'mascot-debug-screen-tools';

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
  private readonly fill = inject(MascotFillService);
  private readonly tools = new Map<string, ClientTool>([[ECHO_TOOL.decl.name, ECHO_TOOL]]);
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
      ...[...this.tools.values()].filter((tool) => this.attempt(() => tool.offered?.() ?? true, false)).map((tool) => tool.decl),
      ...this.attempt(() => this.screenDecls(), []),
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
    return this.tools.get(name)?.run ?? null;
  }

  /**
   * Las herramientas de los formularios montados. Mientras no haya quien las
   * ejecute (`fill_` llega con la fase de formularios), solo se declaran con
   * la clave de depuración: sirve para ver el catálogo real sin ofrecérselo
   * al modelo para nada.
   */
  private screenDecls(): AssistantClientToolDecl[] {
    if (!this.screenToolsEnabled()) return [];
    return this.fill
      .surfaces()
      .filter(({ surface }) => !surface.ready || surface.ready())
      .flatMap(({ surface }) => fillTools(surface).map((tool) => tool.decl));
  }

  private screenToolsEnabled(): boolean {
    // Sin quien las ejecute, cada `fill_` le haría gastar al modelo un paso y
    // decir que falló: solo en desarrollo, para ver el catálogo real.
    if (!isDevMode()) return false;
    try {
      return globalThis.localStorage?.getItem(SCREEN_TOOLS_KEY) === '1';
    } catch {
      return false;
    }
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
