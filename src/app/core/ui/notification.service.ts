import { inject, Injectable } from '@angular/core';
import { TuiToastService } from '@taiga-ui/kit';
import { take } from 'rxjs';

export type NotificationStatus = 'success' | 'error' | 'warning' | 'info';

export interface NotificationOptions {
  status?: NotificationStatus;
  autoClose?: number;
  closable?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly toast = inject(TuiToastService);

  /**
   * Display a notification toast
   * @param message - The main notification message
   * @param options - Configuration options
   */
  show(message: string, options: NotificationOptions = {}): void {
    const {
      status = 'info',
      autoClose = 3000,
      closable = true,
    } = options;

    const appearanceMap: Record<NotificationStatus, string> = {
      success: 'positive',
      error: 'negative',
      warning: 'warning',
      info: 'info',
    };

    this.toast
      .open(message, {
        appearance: appearanceMap[status],
        autoClose,
        closable,
      })
      .pipe(take(1))
      .subscribe();
  }

  /**
   * Display a success notification
   * @param message - The notification message
   * @param autoClose - Auto-close time in ms (default: 3000). Pass Infinity to disable auto-close.
   */
  success(message: string, autoClose = 3000): void {
    this.show(message, { status: 'success', autoClose });
  }

  /**
   * Display an error notification
   * @param message - The error message
   * @param autoClose - Auto-close time in ms (default: 5000). Pass Infinity to disable auto-close.
   */
  error(message: string, autoClose = 5000): void {
    this.show(message, { status: 'error', autoClose });
  }

  /**
   * Display a warning notification
   * @param message - The warning message
   * @param autoClose - Auto-close time in ms (default: 4000). Pass Infinity to disable auto-close.
   */
  warning(message: string, autoClose = 4000): void {
    this.show(message, { status: 'warning', autoClose });
  }

  /**
   * Display an info notification
   * @param message - The info message
   * @param autoClose - Auto-close time in ms (default: 3000). Pass Infinity to disable auto-close.
   */
  info(message: string, autoClose = 3000): void {
    this.show(message, { status: 'info', autoClose });
  }
}
