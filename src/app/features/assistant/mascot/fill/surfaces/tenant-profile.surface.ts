import type { FillOpener, FillSurface } from '../descriptor';
import type { PickOption } from './parse';
import { pickLabel } from './parse';
import { SETTINGS_ADDRESS_TAB } from './settings-section';

/**
 * La dirección del centro (`settings/components/tenant-address-settings`).
 *
 * Tres cosas que la hacen distinta del resto:
 *
 * 1. No es un diálogo sino una sección de Ajustes, así que su "opener" no abre
 *    nada: pulsa la pestaña y ya está, porque la sección se monta sola.
 * 2. Va con `[(ngModel)]` sobre propiedades de la clase, así que el acceso se
 *    construye con `bindingAccess`.
 * 3. Los desplegables guardan la ETIQUETA (`"España"`) y el contrato manda el
 *    CÓDIGO (`"ES"`), y además país y provincia **arrastran** a los siguientes:
 *    elegir país recarga las provincias. Eso lo resuelve el `after` del
 *    binding, no esta superficie.
 *
 * `name`, `cif` y `phone` están en el contrato pero no en esta pantalla: no se
 * editan en ningún sitio de la app todavía, así que se quedan sin rellenar.
 */

interface TenantProfileOptions {
  /** `false` mientras la sección está pidiendo los datos del centro. */
  loaded(): boolean;
  countries(): readonly PickOption[];
  states(): readonly PickOption[];
  cities(): readonly PickOption[];
}

export function tenantProfileSurface(options: TenantProfileOptions): FillSurface {
  return {
    id: 'tenant-profile',
    tools: ['update_tenant_profile'],
    // La sección pide el centro al montarse y, cuando llega, pisa los campos:
    // escribir antes de eso sería escribir para nada.
    ready: () => options.loaded(),
    // El orden importa: país antes que provincia, y provincia antes que
    // ciudad, porque cada uno recarga la lista del siguiente.
    fields: [
      {
        key: 'countryDisplay',
        kind: 'choice',
        from: ['countryCode', 'country', 'pais'],
        parse: (raw) => pickLabel(options.countries(), raw),
      },
      {
        key: 'stateDisplay',
        kind: 'choice',
        from: ['stateCode', 'state', 'provincia', 'region'],
        parse: (raw) => pickLabel(options.states(), raw),
      },
      {
        key: 'cityDisplay',
        kind: 'choice',
        from: ['city', 'ciudad', 'localidad'],
        parse: (raw) => pickLabel(options.cities(), raw),
      },
      { key: 'address', kind: 'text', from: ['address', 'direccion', 'calle', 'street'] },
    ],
  };
}

/**
 * No abre un diálogo: lleva a la pestaña de dirección, donde la sección se
 * monta y se apunta sola. El `trigger` es la propia pestaña, así que pulsarla
 * dos veces (una por `reveal` y otra por `trigger`) sería inofensivo; se deja
 * solo como `trigger` para no pulsar de más.
 */
export const TENANT_PROFILE_OPENER: FillOpener = {
  id: 'tenant-profile',
  tools: ['update_tenant_profile'],
  trigger: SETTINGS_ADDRESS_TAB,
};
