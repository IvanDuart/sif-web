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
   * @param titleOrAutoClose - Optional title (string) or auto-close ms (number, default: 3000).
   *                           Pass Infinity to disable auto-close.
   */
  success(message: string, titleOrAutoClose: string | number = 3000): void {
    if (typeof titleOrAutoClose === 'string') {
      this.show(`<strong>${titleOrAutoClose}</strong><br>${message}`, {
        status: 'success',
        autoClose: 3000,
      });
    } else {
      this.show(message, { status: 'success', autoClose: titleOrAutoClose });
    }
  }

  /**
   * Display an error notification
   * @param message - The error message
   * @param titleOrAutoClose - Optional title (string) or auto-close ms (number, default: 5000).
   *                           Pass Infinity to disable auto-close.
   */
  error(message: string, titleOrAutoClose: string | number = 5000): void {
    if (typeof titleOrAutoClose === 'string') {
      this.show(`<strong>${titleOrAutoClose}</strong><br>${message}`, {
        status: 'error',
        autoClose: 5000,
      });
    } else {
      this.show(message, { status: 'error', autoClose: titleOrAutoClose });
    }
  }

  /**
   * Display a warning notification
   * @param message - The warning message
   * @param titleOrAutoClose - Optional title (string) or auto-close ms (number, default: 4000).
   *                           Pass Infinity to disable auto-close.
   */
  warning(message: string, titleOrAutoClose: string | number = 4000): void {
    if (typeof titleOrAutoClose === 'string') {
      this.show(`<strong>${titleOrAutoClose}</strong><br>${message}`, {
        status: 'warning',
        autoClose: 4000,
      });
    } else {
      this.show(message, { status: 'warning', autoClose: titleOrAutoClose });
    }
  }

  /**
   * Display an info notification
   * @param message - The info message
   * @param titleOrAutoClose - Optional title (string) or auto-close ms (number, default: 3000).
   *                           Pass Infinity to disable auto-close.
   */
  info(message: string, titleOrAutoClose: string | number = 3000): void {
    if (typeof titleOrAutoClose === 'string') {
      this.show(`<strong>${titleOrAutoClose}</strong><br>${message}`, {
        status: 'info',
        autoClose: 3000,
      });
    } else {
      this.show(message, { status: 'info', autoClose: titleOrAutoClose });
    }
  }
}
