import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { choicesOf, pickOption } from './parse';

/**
 * Una comida de una plantilla de menú (`templates/meal-template-form.dialog`).
 *
 * Es lo que le faltaba a «créame una plantilla»: la plantilla se creaba vacía
 * y ahí se quedaba, porque las comidas se añaden una a una desde la rejilla y
 * la mascota no tenía forma de llegar a ese diálogo.
 *
 * El botón de añadir está en cada celda de la rejilla (día × toma), y el
 * diálogo rellena el día y la toma de la celda que se pulsó. Da igual cuál se
 * abra: los tres campos se rellenan después, así que la mascota puede poner
 * cualquier día y cualquier toma desde cualquier celda.
 */

interface MealTemplateOptions {
  days(): readonly PickOption[];
  mealTypes(): readonly PickOption[];
}

export function mealTemplateSurface(options: MealTemplateOptions): FillSurface {
  return {
    id: 'meal-template',
    // El backend tiene `update_meal` para el menú de un paciente, pero nada
    // para las comidas de una plantilla: este formulario es el único camino.
    tools: [],
    fields: [
      {
        key: 'dayOfWeek',
        kind: 'choice',
        from: ['dayOfWeek', 'dia', 'day'],
        ...choicesOf(() => options.days()),
        parse: (raw) => pickOption(options.days(), raw),
      },
      {
        key: 'mealType',
        kind: 'choice',
        from: ['mealType', 'toma', 'comida', 'meal'],
        ...choicesOf(() => options.mealTypes()),
        parse: (raw) => pickOption(options.mealTypes(), raw),
      },
      {
        key: 'description',
        kind: 'text',
        from: ['description', 'descripcion', 'platos', 'texto'],
        long: true,
      },
    ],
  };
}

/** El botón de añadir de cualquier celda de la rejilla: vale el primero que se vea. */
export const MEAL_TEMPLATE_OPENER: FillOpener = {
  id: 'meal-template',
  tools: [],
  // Sin pantalla: la rejilla vive en `/templates/:id` y no se puede llegar sin
  // saber qué plantilla. Se ofrece estando allí —justo después de crearla, que
  // es cuando hace falta— pero no se promete desde fuera.
  trigger: '[data-mascot-open="meal-template"]',
};
