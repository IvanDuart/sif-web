import type { FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickOption } from './parse';

/**
 * Una comida del menú (`menus/meal-form.dialog`).
 *
 * **Lo que NO cubre:** los `items[i].foodId` / `quantityG` / `notes` del
 * contrato. Los alimentos no se editan en este diálogo sino en
 * `menus/components/meal-items-editor`, que no es un formulario de campos: se
 * busca el alimento contra el backend, se elige de una lista de resultados y
 * se guarda solo. Rellenarlo sería teclear una búsqueda, esperar la respuesta
 * y elegir, que es otra mecánica y no la de escribir en un campo. Esos campos
 * se darán por no encontrados y saldrán en la tarjeta.
 *
 * Al editar una comida que ya existe, el diálogo deshabilita el día y el tipo
 * (no se puede mover una comida de sitio desde aquí), así que en la práctica
 * `update_meal` solo escribe la descripción.
 */

interface MealOptions {
  /** Los días tal y como los ofrece el desplegable del diálogo. */
  days(): readonly PickOption[];
  /** Desayuno, comida, cena… con su valor de enum. */
  mealTypes(): readonly PickOption[];
}

export function mealSurface(options: MealOptions): FillSurface {
  return {
    id: 'meal',
    tools: ['update_meal'],
    fields: [
      {
        key: 'dayOfWeek',
        kind: 'choice',
        from: ['dayOfWeek', 'day', 'dia'],
        // Los dos desplegables son `tuiSelect`: guardan el valor, no la etiqueta.
        parse: (raw) => pickOption(options.days(), raw),
      },
      {
        key: 'mealType',
        kind: 'choice',
        from: ['mealType', 'meal', 'tipo', 'tipoComida'],
        parse: (raw) => pickOption(options.mealTypes(), raw),
      },
      { key: 'description', kind: 'text', from: ['description', 'descripcion', 'texto'] },
    ],
  };
}
