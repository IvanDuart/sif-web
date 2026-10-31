import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { TuiBadge, TuiSegmented } from '@taiga-ui/kit';

import { ChatThreadService } from '../../core/api/services/chat-thread.api';
import { ChatUnreadService } from '../../core/api/services/chat-unread.service';
import { NotificationStreamService } from '../../core/api/services/notification-stream.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { NotificationService, ModalService, ConfirmService } from '../../core/ui';
import { ChatThreadSummaryDto } from '../../core/api/models/chat.model';
import { EmptyState } from '../../shared/ui/empty-state';
import { PaginationFooter } from '../../shared/ui/pagination-footer';
import { NewThreadDialog } from './components/new-thread.dialog';

export type ChatThreadFilter = 'active' | 'unread' | 'archived';

@Component({
  selector: 'app-chat-threads-list',
  standalone: true,
  imports: [
    RouterModule,
    DatePipe,
    TranslocoDirective,
    TuiButton,
    TuiBadge,
    TuiSegmented,
    EmptyState,
    PaginationFooter,
  ],
  templateUrl: './chat-threads-list.page.html',
  styleUrl: './chat-threads-list.page.scss',
})
export default class ChatThreadsListPage implements OnInit {
  private readonly chatThreads = inject(ChatThreadService);
  readonly chatUnread = inject(ChatUnreadService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly authService = inject(AuthService);
  private readonly notify = inject(NotificationService);
  private readonly modal = inject(ModalService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);
  private readonly notificationStream = inject(NotificationStreamService);
  private readonly destroyRef = inject(DestroyRef);

  readonly threads = signal<ChatThreadSummaryDto[]>([]);
  readonly loading = signal(false);
  readonly totalRecords = signal(0);
  readonly filter = signal<ChatThreadFilter>('active');
  readonly archivingId = signal<string | null>(null);

  readonly size = 25;
  readonly page = signal(0);

  readonly filterIndex = computed(() => {
    switch (this.filter()) {
      case 'unread': return 1;
      case 'archived': return 2;
      default: return 0;
    }
  });

  ngOnInit(): void {
    this.reload();
    this.chatUnread.refresh();

    // Un mensaje nuevo puede cambiar el orden, la vista previa y el contador.
    this.notificationStream.notifications$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((notification) => {
        if (notification.data?.type === 'CHAT_MESSAGE') this.reload();
      });
  }

  setFilterIndex(index: number): void {
    const next: ChatThreadFilter = index === 1 ? 'unread' : index === 2 ? 'archived' : 'active';
    if (this.filter() === next) return;
    this.filter.set(next);
    this.page.set(0);
    this.reload();
  }

  onPage(page: number): void {
    this.page.set(page);
    this.reload();
  }

  prevPage(): void {
    if (this.page() > 0) {
      this.page.update((page) => page - 1);
      this.reload();
    }
  }

  nextPage(): void {
    if ((this.page() + 1) * this.size < this.totalRecords()) {
      this.page.update((page) => page + 1);
      this.reload();
    }
  }

  private reload(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const userId = this.authService.user()?.id;
    if (!tenantId || !userId) return;

    const filter = this.filter();
    this.loading.set(true);
    this.chatThreads
      .list(tenantId, {
        archived: filter === 'archived',
        unreadOnly: filter === 'unread',
        page: this.page(),
        size: this.size,
      })
      .subscribe({
        next: (response) => {
          this.threads.set(response.content ?? []);
          this.totalRecords.set(response.page?.totalElements ?? 0);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  openThread(thread: ChatThreadSummaryDto): void {
    this.router.navigate(['/chat/threads', thread.id]);
  }

  newConversation(): void {
    this.modal
      .open<ChatThreadSummaryDto | null>(NewThreadDialog, {
        label: this.transloco.translate('chat.new_conversation'),
        size: 'm',
      })
      .subscribe((thread) => {
        if (thread) {
          this.router.navigate(['/chat/threads', thread.id]);
        }
      });
  }

  toggleArchive(thread: ChatThreadSummaryDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId || this.archivingId()) return;

    const archived = !thread.archived;
    this.archivingId.set(thread.id);
    this.chatThreads.archive(tenantId, thread.id, archived).subscribe({
      next: () => {
        this.archivingId.set(null);
        this.notify.success(
          this.transloco.translate(archived ? 'chat.archived_success' : 'chat.unarchived_success')
        );
        this.reload();
        this.chatUnread.refresh();
      },
      error: () => this.archivingId.set(null),
    });
  }

  /** El listado es sólo de staff: el interlocutor siempre es el paciente. */
  participantName(thread: ChatThreadSummaryDto): string {
    return `${thread.patient?.firstName ?? ''} ${thread.patient?.lastName ?? ''}`.trim() || '—';
  }

  initials(thread: ChatThreadSummaryDto): string {
    const first = thread.patient?.firstName?.[0] ?? '';
    const last = thread.patient?.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || '?';
  }

  /** Texto de la vista previa; las imágenes no llevan contenido. */
  preview(thread: ChatThreadSummaryDto): string {
    const last = thread.lastMessage;
    if (!last) return this.transloco.translate('chat.no_messages_yet');
    if (last.kind === 'IMAGE') return last.preview || this.transloco.translate('chat.image_preview');
    return last.preview || this.transloco.translate('chat.message_deleted');
  }

  archiveConfirm(thread: ChatThreadSummaryDto): void {
    const archived = !thread.archived;
    this.confirm
      .confirm({
        label: this.transloco.translate('common.attention'),
        content: this.transloco.translate(archived ? 'chat.archive_confirm' : 'chat.unarchive_confirm', {
          name: this.participantName(thread),
        }),
        yes: this.transloco.translate(archived ? 'chat.archive' : 'chat.unarchive'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (confirmed) this.toggleArchive(thread);
      });
  }
}
