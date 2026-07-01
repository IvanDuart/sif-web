import { inject, Injectable } from '@angular/core';
import { TuiNotificationService } from '@taiga-ui/core';
import { take } from 'rxjs';

export type NotificationStatus = 'success' | 'error' | 'warning' | 'info';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly tui = inject(TuiNotificationService);

  show(
    message: string,
    options: {
      status?: NotificationStatus;
      label?: string;
      autoClose?: number;
    } = {}
  ): void {
    const { status = 'info', label = '', autoClose = 3000 } = options;

    const appearanceMap: Record<NotificationStatus, string> = {
      success: 'positive',
      error: 'negative',
      warning: 'warning',
      info: 'info',
    };

    this.tui
      .open(message, {
        label,
        appearance: appearanceMap[status],
        autoClose,
      })
      .pipe(take(1))
      .subscribe();
  }

  success(message: string, label = ''): void {
    this.show(message, { status: 'success', label });
  }

  error(message: string, label = ''): void {
    this.show(message, { status: 'error', label, autoClose: 5000 });
  }

  warning(message: string, label = ''): void {
    this.show(message, { status: 'warning', label });
  }

  info(message: string, label = ''): void {
    this.show(message, { status: 'info', label });
  }
}
