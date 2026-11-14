import type { FillOpener, FillSurface } from '../descriptor';
import { toNumber } from './measurement.surface';
import type { PickOption } from './parse';
import { choicesOf, pickOption } from './parse';

/**
 * Las recetas del centro: el diálogo que las crea (`recipes/recipe-form.dialog`)
 * y el que vuelca una receta en una comida (`recipes/recipe-instantiate.dialog`).
 *
 * Hasta ahora las recetas no existían para la mascota: a «créame la receta de
 * la tortilla» sólo sabía responder con la tarjeta de confirmar —un resumen de
 * lo que se iba a guardar—, porque no había ninguna superficie que enseñara el
 * formulario.
 *
 * Son DOS superficies y no una porque son dos formularios que no se parecen y
 * cubren escrituras distintas: uno escribe la receta y el otro elige dónde
 * echarla. Meterlas juntas obligaría a `fill_recipe` a declarar campos que la
 * mitad de las veces no están en pantalla.
 *
 * **`clone_recipe` no sale en ninguna de las dos, y es a propósito.** Clonar no
 * se rellena: es un botón de la ficha de la receta que llama al servidor y se
 * va a la copia (`recipe-detail.page.cloneRecipe`). Decir que un formulario la
 * cubre mandaría a la mascota a teclear una receta entera para algo que el
 * servidor hace de una pieza; su sitio sería una acción de esa pantalla, no una
 * superficie.
 */

/**
 * La receta (`recipes/recipe-form.dialog`). Va con `[(ngModel)]` sobre
 * propiedades de la clase, así que el acceso se construye con `bindingAccess`
 * y los campos se anclan por `data-mascot-field`.
 *
 * **Lo que NO cubre**, de lo que manda el `preview` de `create_recipe`:
 *
 * - `items[i].foodId` / `items[i].quantityG`: un ingrediente DEL CATÁLOGO se
 *   busca contra el backend y se elige de una lista, y eso no es escribir en un
 *   campo. Lo que sí puede la mascota es añadirlo **como texto libre**:
 *   escribir el nombre en `foodQuery` y pulsar «recipe-add-ingredient», una vez
 *   por ingrediente. Pierde el enlace con el alimento del catálogo (y con él
 *   los nutrientes), que es el precio de no tener que buscar.
 * - las medidas caseras: filas que se añaden de una en una, sin ancla en el
 *   marcado; el backend tampoco las manda en el `preview`.
 */
export const RECIPE_SURFACE: FillSurface = {
  id: 'recipe',
  tools: ['create_recipe'],
  fields: [
    { key: 'name', kind: 'text', from: ['name', 'nombre', 'recipeName', 'titulo'] },
    {
      key: 'description',
      kind: 'text',
      from: ['description', 'descripcion', 'resumen'],
      long: true,
    },
    { key: 'servings', kind: 'number', from: ['servings', 'porciones', 'raciones'], parse: toNumber },
    {
      key: 'allergensText',
      kind: 'text',
      // El diálogo parte este campo por comas y el backend manda la lista ya
      // unida por ", ": encaja sin traducir nada.
      from: ['allergens', 'alergenos', 'alérgenos'],
    },
    {
      // El nombre del ingrediente, para añadirlo como texto libre.
      //
      // Los ingredientes del catálogo se buscan contra el servidor y se eligen
      // de una lista: eso no es escribir en un campo y la mascota no sabe
      // hacerlo. Pero el formulario admite además texto libre, que no consulta
      // nada, y ESO sí se puede: escribir aquí el nombre y pulsar
      // «recipe-add-ingredient» con `press`, una vez por ingrediente.
      //
      // No es un dato de la receta —no sale en ningún `preview`— y por eso sus
      // alias son los que usaría una persona al pedirlo, no los del backend.
      key: 'foodQuery',
      kind: 'text',
      from: ['foodQuery', 'ingrediente', 'ingredient', 'alimento', 'food'],
      hint: 'Nombre de UN ingrediente. Escribirlo no lo añade: después hay que '
        + 'pulsar «Añadir como texto libre». Uno cada vez.',
    },
    {
      key: 'stepsText',
      kind: 'text',
      long: true,
      from: ['steps', 'pasos', 'instrucciones', 'elaboracion', 'preparacion'],
      /*
       * El `preview` de `create_recipe` manda en `steps` CUÁNTOS pasos hay, no
       * los pasos (`RecipeToolModule`: `String.valueOf(steps.size())`). Poner
       * «3» en la elaboración sería escribir algo que no es, así que un número
       * suelto se descarta y la mascota lo cuenta como no traducible; el texto
       * de verdad, que es lo que llega por `fill_recipe`, pasa tal cual.
       */
      parse: (raw) => (/^\d+$/.test(raw.trim()) ? null : raw),
    },
  ],
};

/** El botón de «Nueva receta» del listado, en la cabecera y en el estado vacío. */
export const RECIPE_OPENER: FillOpener = {
  id: RECIPE_SURFACE.id,
  tools: RECIPE_SURFACE.tools,
  screen: 'RECIPES',
  trigger: '[data-mascot-open="recipe"]',
};

interface RecipeInstantiateOptions {
  /** Menú o plantilla, con el texto que enseña el desplegable. */
  targets(): readonly PickOption[];
  /** Los menús —o las plantillas, según el destino— del centro. */
  sources(): readonly PickOption[];
  /** Las comidas del destino elegido; vacío mientras no haya destino. */
  meals(): readonly PickOption[];
  /** `false` mientras el diálogo está pidiendo los menús del centro. */
  loaded(): boolean;
}

/**
 * Volcar la receta en una comida (`recipes/recipe-instantiate.dialog`).
 *
 * Sus controles son `FormControl` sueltos (no hay `FormGroup`), así que el
 * acceso también va por `bindingAccess`; los campos se anclan por el `id` que
 * ya tenía cada `input`, que para eso está.
 *
 * Dos cosas que conviene saber al leer un `fill_recipe_instantiate`:
 *
 * 1. **La receta no se elige aquí**: es la de la ficha desde la que se abrió el
 *    diálogo. Por eso el `recipeId` del `preview` —y los `ingredients`, que
 *    vienen con ella— no son campos de este formulario y saldrán sin casar.
 * 2. **El menú tampoco viaja en el `preview`**: `instantiate_recipe_in_meal`
 *    manda la comida (`mealId`) y nada más, pero la comida no se puede elegir
 *    hasta haber elegido el menú, que se pide al servidor al cambiarlo. Por eso
 *    `source` se declara igual: no llega del `preview`, pero el modelo sí sabe
 *    de qué menú habla y puede nombrarlo él. Si escribe la comida antes de que
 *    lleguen las del menú, no la encontrará entre las opciones y el campo se
 *    quedará para la persona, que es mejor que elegir otra.
 */
export function recipeInstantiateSurface(options: RecipeInstantiateOptions): FillSurface {
  return {
    id: 'recipe-instantiate',
    tools: ['instantiate_recipe_in_meal'],
    // Los menús del centro llegan por HTTP al abrir el diálogo, y hasta
    // entonces el desplegable está vacío y deshabilitado.
    ready: () => options.loaded(),
    // El orden importa: el destino vacía el menú, y el menú vacía la comida.
    fields: [
      {
        key: 'targetType',
        kind: 'choice',
        from: ['targetType', 'target', 'destino', 'tipoDestino'],
        anchor: '#targetTypeSelect',
        ...choicesOf(() => options.targets()),
        parse: (raw) => pickOption(options.targets(), raw),
      },
      {
        key: 'source',
        kind: 'choice',
        from: ['sourceId', 'menuId', 'menu', 'menuName', 'templateId', 'plantilla'],
        anchor: '#sourceSelect',
        ...choicesOf(() => options.sources()),
        parse: (raw) => pickOption(options.sources(), raw),
      },
      {
        key: 'meal',
        kind: 'choice',
        from: ['mealId', 'meal', 'comida', 'toma'],
        anchor: '#mealSelect',
        // La etiqueta de la comida es la misma a los dos lados —día · toma ·
        // descripción—, así que lo que manda el backend casa con la opción.
        ...choicesOf(() => options.meals()),
        parse: (raw) => pickOption(options.meals(), raw),
      },
      {
        key: 'servings',
        kind: 'number',
        from: ['servings', 'porciones', 'raciones'],
        anchor: '#servingsInput',
        parse: toNumber,
      },
    ],
  };
}

/**
 * El botón de «Añadir a un menú» de la ficha de la receta.
 *
 * Sin pantalla: la ficha vive en `/recipes/:id` y `navigate` no sabe llegar a
 * una receta concreta —`RECIPES` lleva al listado—, así que el botón se ofrece
 * estando ya aquí y no se promete desde fuera. Prometer un sitio al que no se
 * puede ir es lo que hace que la mascota navegue, no encuentre nada y se rinda.
 */
export const RECIPE_INSTANTIATE_OPENER: FillOpener = {
  id: 'recipe-instantiate',
  tools: ['instantiate_recipe_in_meal'],
  trigger: '[data-mascot-open="recipe-instantiate"]',
};
