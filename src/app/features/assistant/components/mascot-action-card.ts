import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslocoDirective } from '@jsverse/transloco';

import { AssistantPendingActionDto } from '../../../core/api/models/assistant.model';
import { MascotRichText } from './mascot-rich-text';

/**
 * Tarjeta de confirmación de una escritura. Muestra el resumen y la vista
 * previa que devuelve el backend; nunca aplica nada por sí sola.
 */
@Component({
  selector: 'app-mascot-action-card',
  standalone: true,
  imports: [TranslocoDirective, MascotRichText],
  templateUrl: './mascot-action-card.html',
  styleUrl: './mascot-action-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MascotActionCard {
  action = input.required<AssistantPendingActionDto>();
  busy = input(false);

  confirmed = output<AssistantPendingActionDto>();
  cancelled = output<AssistantPendingActionDto>();
}
