import { Injectable, inject } from '@angular/core';

import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import type { ToolRun } from './client-tool.model';
import { CursorService } from './cursor.service';
import { QuestionService } from './question.service';
import { WriteWatchService } from './write-watch.service';
import { actionTool, editTool, fillTools, openTool, saveTool } from './schema';
import { runAction } from './tools/action.run';
import { runEdit } from './tools/edit.run';
import { runFill } from './tools/fill.run';
import { runOpen } from './tools/open.run';
import { runSave } from './tools/save.run';

/** Lo que una herramienta de pantalla necesita de fuera para ejecutarse. */
export interface ScreenToolDeps {
  /** El catálogo de después, para las herramientas que cambian la pantalla. */
  catalog: () => unknown;
}

/**
 * Las herramientas que salen de lo que hay montado en la pantalla: `fill_`,
 * `edit_` y `open_`.
 *
 * Declararlas y ejecutarlas sale del MISMO sitio —`fillTools`, `editTool` y
 * `openTool`, llamados otra vez al despachar— porque un catálogo que dice una
 * cosa y un despacho que hace otra es el fallo que no da error: el modelo
 * llama a algo que vio y le contestan `unknown_tool` sin que nadie se entere.
 */
@Injectable({ providedIn: 'root' })
export class ScreenToolsService {
  private readonly fill = inject(MascotFillService);
  private readonly questions = inject(QuestionService);
  private readonly cursor = inject(CursorService);
  private readonly writes = inject(WriteWatchService);

  /** Lo que se puede hacer en esta pantalla, ahora mismo. */
  decls(): AssistantClientToolDecl[] {
    const mounted = this.fill.surfaces().filter(({ surface }) => !surface.ready || surface.ready());
    return [
      ...mounted.flatMap(({ surface }) => fillTools(surface).map((tool) => tool.decl)),
      ...mounted.flatMap(({ surface }) => {
        const tool = editTool(surface);
        return tool ? [tool.decl] : [];
      }),
      ...mounted.flatMap(({ surface }) => {
        const tool = saveTool(surface);
        return tool ? [tool] : [];
      }),
      // Abrir solo se ofrece de lo que NO está abierto: ofrecer `open_` de un
      // diálogo que ya está en pantalla invita al modelo a abrirlo dos veces.
      ...this.fill
        .allOpeners()
        .filter((opener) => !this.fill.forId(opener.id))
        .flatMap((opener) => {
          const decl = openTool(opener.id);
          return decl ? [decl] : [];
        }),
      ...this.fill.allActions().flatMap((action) => {
        const decl = actionTool(action);
        return decl ? [decl] : [];
      }),
    ];
  }

  /** Cómo se ejecuta, si este nombre es de una herramienta de pantalla. */
  runFor(name: string, deps: ScreenToolDeps): ToolRun | null {
    for (const { surface } of this.fill.surfaces()) {
      const fillMatch = fillTools(surface).find((tool) => tool.decl.name === name);
      if (fillMatch) {
        return (args, { signal }) => runFill(surface.id, fillMatch.keys, args, { fill: this.fill, cursor: this.cursor, signal });
      }
      const edit = editTool(surface);
      if (edit?.decl.name === name) {
        return (args, { signal }) => runEdit(surface.id, edit.keys, args, { fill: this.fill, signal });
      }
    }

    for (const { surface, access } of this.fill.surfaces()) {
      if (saveTool(surface)?.name !== name) continue;
      return (_args, { signal }) =>
        runSave(surface, access, {
          fill: this.fill,
          questions: this.questions,
          writes: this.writes,
          cursor: this.cursor,
          signal,
        });
    }

    for (const opener of this.fill.allOpeners()) {
      if (openTool(opener.id)?.name !== name) continue;
      return (_args, { signal }) => runOpen(opener.id, { fill: this.fill, signal, catalog: deps.catalog });
    }

    for (const action of this.fill.allActions()) {
      if (actionTool(action)?.name !== name) continue;
      return (_args, { signal }) => runAction(action, { questions: this.questions, signal });
    }

    return null;
  }
}
