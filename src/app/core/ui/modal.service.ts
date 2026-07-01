import { inject, Injectable, Type } from '@angular/core';
import { TuiDialogService } from '@taiga-ui/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { Observable } from 'rxjs';

export interface ModalOptions<I = undefined> {
  label?: string;
  size?: 's' | 'm' | 'l';
  data?: I;
  closable?: boolean;
  dismissible?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ModalService {
  private readonly dialogs = inject(TuiDialogService);

  /**
   * Open a component in a Taiga UI dialog.
   * The component can inject its context via:
   *   context = injectContext<TuiDialogContext<Output, Input>>()
   *
   * @returns Observable that emits the output value on close
   */
  open<O = void, I = undefined>(
    component: Type<unknown>,
    options: ModalOptions<I> = {}
  ): Observable<O> {
    return this.dialogs.open<O>(new PolymorpheusComponent(component), {
      label: options.label ?? '',
      size: options.size ?? 'm',
      data: options.data as I extends void ? undefined : I,
      closable: options.closable ?? true,
      dismissible: options.dismissible ?? true,
    });
  }
}
