import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TuiButton } from '@taiga-ui/core';
import { TuiShrinkWrap } from '@taiga-ui/kit';
import { injectContext } from '@taiga-ui/polymorpheus';

/** Payload for an undoable toast (see `NotificationService.undo`). */
export interface ToastUndoData {
  readonly message: string;
  readonly undoLabel: string;
  readonly onUndo: () => void;
}

/** Context `TuiToastService` hands over when the content is a component. */
interface ToastUndoContext {
  readonly data: ToastUndoData;
  completeWith(): void;
}

/**
 * Content of an undoable toast (Guía §6): the message plus a "Deshacer"
 * action. `display: contents` lets the message and the action participate in
 * the toast's own grid instead of being wrapped in an extra box.
 */
@Component({
  selector: 'app-toast-undo',
  standalone: true,
  imports: [TuiButton, TuiShrinkWrap],
  templateUrl: './toast-undo.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastUndo {
  private readonly context = injectContext<ToastUndoContext>();

  protected get data(): ToastUndoData {
    return this.context.data;
  }

  protected onUndo(): void {
    this.data.onUndo();
    this.context.completeWith();
  }
}
