import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickOption } from './parse';

/**
 * A qué nutricionista se asigna el paciente
 * (`users/assign-nutritionist.dialog`). El `tuiSelect` guarda el id y enseña
 * el nombre; el asistente manda el nombre, así que hay que traducirlo.
 */

interface AssignNutritionistOptions {
  nutritionists(): readonly PickOption[];
}

export function assignNutritionistSurface(options: AssignNutritionistOptions): FillSurface {
  return {
    id: 'assign-nutritionist',
    tools: ['assign_nutritionist'],
    fields: [
      {
        key: 'nutritionistId',
        kind: 'choice',
        from: ['nutritionistId', 'nutritionist', 'nutricionista', 'professional', 'name'],
        parse: (raw) => pickOption(options.nutritionists(), raw),
      },
    ],
  };
}

/** El botón está en la pestaña de perfil de la ficha. */
export const ASSIGN_NUTRITIONIST_OPENER: FillOpener = {
  id: 'assign-nutritionist',
  tools: ['assign_nutritionist'],
  reveal: ['[data-mascot-reveal="tab-profile"]'],
  trigger: '[data-mascot-open="assign-nutritionist"]',
};
