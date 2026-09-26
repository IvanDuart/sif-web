import { Component, computed, input, output } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Pie de paginación compartido por los listados (menús, plantillas, pacientes,
 * equipo). Recibe el estado de paginación y emite la navegación; el cálculo de
 * "mostrando X a Y" y el habilitado de los botones vive aquí, en un solo sitio.
 */
@Component({
  selector: 'app-pagination-footer',
  standalone: true,
  imports: [TuiButton, TranslocoPipe],
  templateUrl: './pagination-footer.html',
  styles: [':host { display: block; }']
})
export class PaginationFooter {
  /** Página actual, base 0. */
  page = input.required<number>();
  /** Tamaño de página. */
  size = input.required<number>();
  /** Total de registros del conjunto filtrado. */
  total = input.required<number>();
  /** Deshabilita los controles mientras hay una carga en vuelo. */
  busy = input(false);

  prev = output<void>();
  next = output<void>();

  readonly first = computed(() => (this.total() === 0 ? 0 : this.page() * this.size() + 1));
  readonly last = computed(() => Math.min((this.page() + 1) * this.size(), this.total()));
  readonly hasPrev = computed(() => this.page() > 0);
  readonly hasNext = computed(() => (this.page() + 1) * this.size() < this.total());
}
