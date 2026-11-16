import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import type { AssistantPageContext } from '../../../core/api/models/assistant.model';
import type { FieldAccess, FillField, FillSurface } from '../mascot/fill/descriptor';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { fitPageContext, serializeValue } from './page-context';
import { AssistantFeaturesService } from './assistant-features.service';
import { reachableForms } from './reachable-forms';
import { slugOf } from './tool-names';

/**
 * Lo que la persona tiene delante, para mandárselo al modelo con cada mensaje
 * (`assistant-contract` §3.2, «Qué hay en pantalla»).
 *
 * Sin esto el modelo no sabe qué pone ya en cada campo y, para cambiar una
 * frase, tendría que reescribir el campo entero a ciegas.
 *
 * Lo que aquí falla no tumba el turno: un formulario que lanza al leerse se
 * salta y el mensaje sale con lo demás.
 */
@Injectable({ providedIn: 'root' })
export class PageContextService {
  private readonly router = inject(Router);
  private readonly fill = inject(MascotFillService);
  private readonly title = inject(Title);
  private readonly features = inject(AssistantFeaturesService);

  build(): AssistantPageContext {
    const forms: NonNullable<AssistantPageContext['forms']> = [];
    for (const { surface, access } of this.fill.surfaces()) {
      // Uno que aún carga tiene valores a medias: contarlos confunde.
      if (!this.attempt(() => !surface.ready || surface.ready(), true)) continue;
      const share = this.attempt(() => !surface.contextual || surface.contextual(), false);
      const values = share ? this.attempt(() => this.valuesOf(surface, access), null) : {};
      if (values === null) continue;
      forms.push({ id: slugOf(surface.id), values });
    }

    const extras = this.extrasOf();
    const title = this.title.getTitle().trim();
    const fitted = fitPageContext({
      // Sin la query: puede traer ids o búsquedas que el modelo no necesita.
      route: this.router.url.split('?')[0].split('#')[0],
      ...(title ? { title } : {}),
      forms,
      ...(Object.keys(extras).length > 0 ? { extras } : {}),
    });

    // El mapa de formularios va DESPUÉS de recortar y nunca se recorta: es lo
    // que permite al modelo ir a buscar un formulario que no está delante, y
    // sin él se queda escribiendo por detrás. El backend tampoco lo cuenta
    // contra su presupuesto (`assistant-contract` §3.2).
    return { ...fitted, reachableForms: reachableForms((requirement) => this.features.has(requirement)) };
  }

  private extrasOf(): Record<string, unknown> {
    return this.attempt(() => this.fill.readExtras(), {});
  }

  private valuesOf(surface: FillSurface, access: FieldAccess): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const field of surface.fields) {
      values[field.key] = this.attempt(() => this.fieldValue(field, access.get(field.key)), null);
    }

    // Las filas, en el mismo formato que las recibe `fill_`: una cadena por fila.
    for (const list of surface.lists ?? []) {
      const rows: string[] = [];
      this.attempt(() => {
        for (let index = 0; index < list.size(); index += 1) {
          rows.push(
            list.fields
              .map((field) => String(this.fieldValue(field, access.get(`${list.key}.${index}.${field.key}`)) ?? ''))
              .join(' | '),
          );
        }
      }, undefined);
      values[list.key] = rows;
    }
    return values;
  }

  /**
   * El valor como lo entiende el modelo: un campo de elección guarda un id,
   * pero él habla en etiquetas. Si no se sabe qué etiqueta es, mejor nada que
   * un id que no significa nada.
   */
  private fieldValue(field: FillField, raw: unknown): unknown {
    if (field.kind === 'choice' && field.valueLabel) {
      if (raw === null || raw === undefined || raw === '') return null;
      return field.valueLabel(raw);
    }
    return serializeValue(raw);
  }

  /** Código de pantalla ajeno: si lanza, se sigue con `fallback`. */
  private attempt<T>(read: () => T, fallback: T): T {
    try {
      return read();
    } catch {
      return fallback;
    }
  }
}
