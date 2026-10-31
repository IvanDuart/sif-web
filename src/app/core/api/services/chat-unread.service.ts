import { Injectable, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ChatThreadService } from './chat-thread.api';
import { TenantContextService } from '../../tenant/tenant-context.service';
import { PermissionsService } from '../../permissions/permissions.service';

/**
 * Contador de mensajes sin leer para el badge del menú. No hay endpoint
 * dedicado: se suman los `unreadCount` de los hilos activos.
 *
 * El `Shell` lo refresca al abrir el canal y con cada aviso `CHAT_MESSAGE`; la
 * pantalla de conversación lo ajusta al marcar leído.
 */
@Injectable({ providedIn: 'root' })
export class ChatUnreadService {
  private readonly chatThreads = inject(ChatThreadService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly permissions = inject(PermissionsService);

  readonly unread = signal(0);

  private inFlight = false;
  private pending = false;

  /** ¿El usuario actual puede ver el chat (staff con `MANAGE_CHAT`)? */
  get available(): boolean {
    return this.tenantCtx.currentMembership()?.userType === 'STAFF'
      && this.permissions.has('MANAGE_CHAT');
  }

  refresh(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || !this.available) {
      this.unread.set(0);
      return;
    }
    // Evita ráfagas cuando llegan varios avisos seguidos.
    if (this.inFlight) {
      this.pending = true;
      return;
    }

    this.inFlight = true;
    this.chatThreads
      .list(tenantId, { archived: false, page: 0, size: 100 })
      .pipe(
        finalize(() => {
          this.inFlight = false;
          if (this.pending) {
            this.pending = false;
            this.refresh();
          }
        })
      )
      .subscribe({
        next: (page) => {
          this.unread.set((page.content ?? []).reduce((total, thread) => total + (thread.unreadCount || 0), 0));
        },
        error: () => this.unread.set(0),
      });
  }

}
