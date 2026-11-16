import { Injectable, inject } from '@angular/core';

import type { AssistantClientToolDecl } from '../../../core/api/models/assistant.model';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MAX_DESCRIPTION } from './catalog-rules';
import { pointables } from './pointing';
import { CursorService } from './cursor.service';
import { PersonSaveService } from './person-save.service';
import { QuestionService } from './question.service';
import { ToolRegistryService } from './tool-registry.service';
import { runAskUser } from './tools/ask.run';
import { runPointAt } from './tools/point.run';
import { runPress } from './tools/press.run';
import { runShowAround } from './tools/tour.run';

/** Más controles que esto no caben en el esquema sin comerse el presupuesto. */
const MAX_CONTROLS = 24;

/**
 * Las herramientas de hablar y señalar: `ask_user`, `point_at`, `show_around`
 * y `press`.
 *
 * Se registran aquí, y no en cada pantalla, porque no dependen de ninguna: lo
 * que cambia con la pantalla son los controles que se pueden señalar, y eso
 * entra por `refine`, que rellena el `enum` con lo que hay marcado ahora.
 *
 * Sin ese `enum` el modelo tendría que adivinar los ids, y adivinar un id es
 * exactamente lo que acaba en «no encuentro ese control» una y otra vez.
 */
@Injectable({ providedIn: 'root' })
export class InteractionToolsService {
  private readonly registry = inject(ToolRegistryService);
  private readonly questions = inject(QuestionService);
  private readonly saves = inject(PersonSaveService);
  private readonly fill = inject(MascotFillService);
  private readonly cursor = inject(CursorService);

  constructor() {
    this.registry.register({
      decl: {
        name: 'ask_user',
        description:
          'Pregunta algo que hace falta para seguir y espera la respuesta. Si la persona pulsa Guardar en el '
          + 'formulario mientras esperas, eso es la respuesta: te llega con saved y una nota.',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string' },
            options: { type: 'array', items: { type: 'string' }, description: 'Respuestas sugeridas' },
          },
          required: ['question'],
        },
      },
      run: (args, { signal }) => runAskUser(args, { questions: this.questions, saves: this.saves, signal }),
    });

    this.registry.register({
      decl: {
        name: 'point_at',
        description: 'Señala un control de la pantalla sin pulsarlo',
        parameters: { type: 'object', properties: { control: { type: 'string' } }, required: ['control'] },
      },
      offered: () => pointables().length > 0,
      refine: (decl) => this.withControls(decl),
      run: (args, { signal }) => runPointAt(args, { fill: this.fill, signal }),
    });

    this.registry.register({
      decl: {
        name: 'show_around',
        description: 'Recorre varios controles explicando cada uno',
        parameters: {
          type: 'object',
          properties: {
            stops: {
              type: 'array',
              description: 'Cada parada, «control | qué decir»',
              items: { type: 'string' },
            },
          },
          required: ['stops'],
        },
      },
      offered: () => pointables().length > 1,
      run: (args, { signal }) => runShowAround({ stops: parseStops(args['stops']) }, { fill: this.fill, cursor: this.cursor, signal }),
    });

    this.registry.register({
      decl: {
        name: 'press',
        description: 'Pulsa un control de la pantalla; lo que no se deshace se pregunta antes',
        parameters: { type: 'object', properties: { control: { type: 'string' } }, required: ['control'] },
      },
      offered: () => pointables().length > 0,
      refine: (decl) => this.withControls(decl),
      run: (args, { signal }) => runPress(args, { fill: this.fill, questions: this.questions, cursor: this.cursor, signal }),
    });
  }

  /** La declaración con los controles que hay ahora mismo en pantalla. */
  private withControls(decl: AssistantClientToolDecl): AssistantClientToolDecl {
    const found = pointables().slice(0, MAX_CONTROLS);
    const described = found
      .map((control) => `${control.id}: ${control.label}`)
      .join('; ')
      .slice(0, MAX_DESCRIPTION);
    return {
      ...decl,
      parameters: {
        type: 'object',
        properties: {
          control: { type: 'string', enum: found.map((control) => control.id), description: described },
        },
        required: ['control'],
      },
    };
  }
}

/**
 * Las paradas llegan como cadenas «control | qué decir»: un array de objetos
 * pasaría de los 3 niveles que acepta el backend, igual que las filas de una
 * lista en `schema.ts`.
 */
function parseStops(raw: unknown): { control: string; say: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (typeof item !== 'string') return [];
    const [control, ...rest] = item.split('|');
    const id = control.trim();
    return id === '' ? [] : [{ control: id, say: rest.join('|').trim() }];
  });
}
