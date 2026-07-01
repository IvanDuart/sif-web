import { inject, Injectable } from '@angular/core';
import { TuiConfirmService } from '@taiga-ui/kit';
import { Observable } from 'rxjs';

export interface ConfirmOptions {
  label?: string;
  content?: string;
  yes?: string;
  no?: string;
  size?: 's' | 'm' | 'l';
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly tui = inject(TuiConfirmService);

  /**
   * Open a Taiga UI confirm dialog.
   * @returns Observable<boolean> — true if confirmed, false/complete if cancelled
   */
  confirm(options: ConfirmOptions = {}): Observable<boolean> {
    return this.tui.withConfirm({
      label: options.label ?? 'Confirmar',
      size: options.size ?? 's',
      data: {
        content: options.content ?? '¿Estás seguro?',
        yes: options.yes ?? 'Confirmar',
        no: options.no ?? 'Cancelar',
      },
    });
  }
}
