import type { ReachableForm } from '../../../core/api/models/assistant.model';
import type { FillOpener, OpenerRequirement } from '../mascot/fill/descriptor';
import { ALL_OPENERS } from '../mascot/fill/surfaces/openers';
import { slugOf } from './tool-names';

/**
 * Dónde vive cada formulario de la aplicación.
 *
 * Sin esto, el modelo sólo conoce los de la pantalla en la que está. Desde el
 * panel principal `fill_measurement` no se declara, así que desde donde él mira
 * **la medición no tiene formulario**: lo único que sabe para apuntar un peso
 * es `create_measurement`, y la persona acaba confirmando una tarjeta en vez de
 * ver lo que se guarda.
 *
 * **Se deriva de los openers**, no es una lista aparte. Una tabla paralela
 * acaba prometiendo formularios en pantallas donde no hay ningún botón que
 * pulsar: la mascota navega hasta allí, no encuentra nada y se rinde, que es
 * peor que no haber ofrecido el camino. Cada opener dice en qué pantalla está
 * su botón, y eso es lo que viaja.
 */

/**
 * Lo que está en pantalla sin tener que abrir nada.
 *
 * La anamnesis no se abre con un botón: está en la ficha, detrás de su
 * pestaña. No tiene opener y aun así se llega a ella navegando.
 */
const SIN_ABRIR: readonly ReachableForm[] = [
  {
    id: 'patient_profile',
    screen: 'PATIENT_PROFILE',
    needsPatient: true,
    tools: ['update_profile', 'update_anamnesis'],
  },
];

function fromOpener(opener: FillOpener): ReachableForm {
  return {
    // Por `slugOf`, el mismo que convierte `patient-profile` en
    // `fill_patient_profile`: con guion, el modelo navegaría a un formulario
    // cuyo nombre de herramienta no existe.
    id: slugOf(opener.id),
    screen: opener.screen!,
    needsPatient: opener.needsPatient === true,
    // El opener ya sabe qué escrituras de servidor cubre su formulario.
    tools: opener.tools,
  };
}

export function reachableForms(has: (requirement: OpenerRequirement | undefined) => boolean = () => true): ReachableForm[] {
  const out = [...SIN_ABRIR];
  for (const opener of ALL_OPENERS) {
    // Sin pantalla no se promete: no habría forma de llegar.
    if (!opener.screen) continue;
    // Ni lo que el centro no tiene: el backend retiraría su escritura y la
    // mascota se quedaría sin ningún camino.
    if (!has(opener.requires)) continue;
    const entry = fromOpener(opener);
    if (!out.some((form) => form.id === entry.id)) out.push(entry);
  }
  return out;
}
