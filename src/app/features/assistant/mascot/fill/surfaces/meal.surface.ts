import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickOption, choicesOf } from './parse';

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
        ...choicesOf(() => options.days()),
        parse: (raw) => pickOption(options.days(), raw),
      },
      {
        key: 'mealType',
        kind: 'choice',
        from: ['mealType', 'meal', 'tipo', 'tipoComida'],
        ...choicesOf(() => options.mealTypes()),
        parse: (raw) => pickOption(options.mealTypes(), raw),
      },
      { key: 'description', kind: 'text', from: ['description', 'descripcion', 'texto'], long: true },
    ],
  };
}

/**
 * El botón de añadir de un hueco libre de la rejilla del menú
 * (`menus/menu-detail`), que abre este mismo diálogo.
 *
 * Es el de AÑADIR y no el lápiz de una comida que ya existe a propósito: desde
 * un hueco, el día y la toma siguen habilitados y la mascota puede llevar la
 * comida a la casilla que se pidió. Desde una comida concreta abriría la
 * primera que se viera en pantalla, que casi nunca es la que se pedía, y encima
 * con el día y la toma bloqueados.
 *
 * Y es el único camino para CREAR una comida: el catálogo del backend tiene
 * `update_meal`, que cambia una que ya existe, pero ninguna que la cree.
 *
 * Sin pantalla: la rejilla vive en `/menus/:id` y `navigate` no sabe llegar a
 * un menú concreto (`MENU` lleva al listado o a la pestaña de la ficha), así
 * que el botón se ofrece estando ya aquí y no se promete desde fuera.
 */
export const MEAL_OPENER: FillOpener = {
  id: 'meal',
  tools: ['update_meal'],
  trigger: '[data-mascot-open="meal"]',
};
