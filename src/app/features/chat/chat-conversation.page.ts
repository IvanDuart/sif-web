import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { TuiButton } from '@taiga-ui/core';
import { Subscription } from 'rxjs';

import { ChatMessageService } from '../../core/api/services/chat-message.api';
import { ChatStreamService } from '../../core/api/services/chat-stream.service';
import { ChatThreadService } from '../../core/api/services/chat-thread.api';
import { ChatUnreadService } from '../../core/api/services/chat-unread.service';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { ConfirmService, NotificationService } from '../../core/ui';
import {
  ChatMessageDto,
  ChatStreamEvent,
  ChatThreadDto,
} from '../../core/api/models/chat.model';
import { LiveIndicator } from '../../shared/ui/live-indicator';
import { ChatMessageBubble, initialsOf } from './components/chat-message-bubble';
import { ChatMessageInput } from './components/chat-message-input';

const PAGE_SIZE = 30;
/** Distancia al fondo por debajo de la cual se sigue el hilo automáticamente. */
const STICK_TO_BOTTOM_PX = 140;

@Component({
  selector: 'app-chat-conversation',
  standalone: true,
  imports: [
    RouterModule,
    DatePipe,
    TranslocoDirective,
    TuiButton,
    LiveIndicator,
    ChatMessageBubble,
    ChatMessageInput,
  ],
  templateUrl: './chat-conversation.page.html',
  styleUrl: './chat-conversation.page.scss',
  host: { '(document:visibilitychange)': 'onVisibilityChange()' },
})
export default class ChatConversationPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly chatThreads = inject(ChatThreadService);
  private readonly chatMessages = inject(ChatMessageService);
  private readonly chatStream = inject(ChatStreamService);
  private readonly chatUnread = inject(ChatUnreadService);
  private readonly authService = inject(AuthService);
  private readonly tenantCtx = inject(TenantContextService);
  private readonly confirm = inject(ConfirmService);
  private readonly notify = inject(NotificationService);
  private readonly transloco = inject(TranslocoService);

  private readonly scrollHost = viewChild<ElementRef<HTMLElement>>('scrollHost');
  private readonly composer = viewChild(ChatMessageInput);

  readonly threadId = signal('');
  readonly thread = signal<ChatThreadDto | null>(null);
  readonly messages = signal<ChatMessageDto[]>([]);
  readonly loading = signal(true);
  readonly loadingOlder = signal(false);
  readonly hasMore = signal(false);
  readonly connected = signal(false);
  readonly sending = signal(false);
  readonly archiving = signal(false);
  readonly otherLastReadId = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.user()?.id ?? null);
  readonly partner = computed(() => this.thread()?.patient ?? null);
  readonly partnerName = computed(() => {
    const patient = this.partner();
    return patient ? `${patient.firstName} ${patient.lastName}`.trim() : '...';
  });
  readonly partnerInitials = computed(() => initialsOf(this.partner()));
  readonly readThroughIndex = computed(() => {
    const id = this.otherLastReadId();
    if (!id) return -1;
    return this.messages().findIndex((message) => message.id === id);
  });

  private nextCursor: string | null = null;
  private streamSubscription: Subscription | null = null;
  private hasConnected = false;
  private lastMarkedReadId: string | null = null;

  ngOnInit(): void {
    const threadId = this.route.snapshot.paramMap.get('threadId');
    if (!threadId) {
      void this.router.navigate(['/chat/threads']);
      return;
    }

    this.threadId.set(threadId);
    this.loadThread();
    this.loadFirstPage(true);
    this.connectStream();
  }

  ngOnDestroy(): void {
    this.streamSubscription?.unsubscribe();
  }

  onVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.markLatestAsRead();
    }
  }

  // ── Carga REST ──────────────────────────────────────────────────────

  private loadThread(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId) return;

    this.chatThreads.get(tenantId, threadId).subscribe({
      next: (thread) => this.thread.set(thread),
      error: () => void this.router.navigate(['/chat/threads']),
    });
  }

  private loadFirstPage(scrollToBottom: boolean): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId) return;

    this.loading.set(true);
    this.chatMessages.list(tenantId, threadId, null, PAGE_SIZE).subscribe({
      next: (page) => {
        this.messages.set([...(page.items ?? [])].reverse());
        this.nextCursor = page.nextCursor ?? null;
        this.hasMore.set(!!page.hasMore);
        this.loading.set(false);
        this.markLatestAsRead();
        if (scrollToBottom) this.scrollToBottom('auto');
      },
      error: () => this.loading.set(false),
    });
  }

  /** Tras reconectar: trae lo último y lo fusiona sin tocar lo ya cargado. */
  private reloadLatest(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId) return;

    const host = this.scrollHost()?.nativeElement;
    const nearBottom = host
      ? host.scrollHeight - host.scrollTop - host.clientHeight < STICK_TO_BOTTOM_PX
      : true;

    this.chatMessages.list(tenantId, threadId, null, PAGE_SIZE).subscribe({
      next: (page) => {
        const latest = [...(page.items ?? [])].reverse();
        this.messages.update((current) => {
          const known = new Set(current.map((message) => message.id));
          const missing = latest.filter((message) => !known.has(message.id));
          if (missing.length === 0) return current;
          return [...current, ...missing].sort(
            (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
          );
        });
        if (!this.nextCursor) this.nextCursor = page.nextCursor ?? null;
        this.markLatestAsRead();
        if (nearBottom) this.scrollToBottom('auto');
      },
    });
  }

  loadOlder(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    const before = this.nextCursor;
    if (!tenantId || !threadId || !before || this.loadingOlder()) return;

    const host = this.scrollHost()?.nativeElement;
    const previousHeight = host?.scrollHeight ?? 0;

    this.loadingOlder.set(true);
    this.chatMessages.list(tenantId, threadId, before, PAGE_SIZE).subscribe({
      next: (page) => {
        const older = [...(page.items ?? [])].reverse();
        this.messages.update((current) => [...older, ...current]);
        this.nextCursor = page.nextCursor ?? null;
        this.hasMore.set(!!page.hasMore);
        this.loadingOlder.set(false);

        // Mantener el punto de lectura al insertar contenido arriba.
        requestAnimationFrame(() => {
          const element = this.scrollHost()?.nativeElement;
          if (element) element.scrollTop += element.scrollHeight - previousHeight;
        });
      },
      error: () => this.loadingOlder.set(false),
    });
  }

  // ── SSE ─────────────────────────────────────────────────────────────

  private connectStream(): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId) return;

    this.streamSubscription = this.chatStream
      .streamThread(tenantId, threadId, {
        onConnectionChange: (connected) => {
          this.connected.set(connected);
          if (!connected) return;

          // El servidor cierra a los 30 min y no hay replay: al reconectar se
          // recarga la primera página para tapar el hueco, sin perder los
          // mensajes antiguos ya cargados.
          if (this.hasConnected) {
            this.reloadLatest();
          }
          this.hasConnected = true;
        },
      })
      .subscribe({
        next: (event) => this.onStreamEvent(event),
        error: () => this.connected.set(false),
      });
  }

  private onStreamEvent(event: ChatStreamEvent): void {
    switch (event.type) {
      case 'message': {
        const isNew = this.addMessage(event.message);
        if (!isNew) return;
        const fromOther = event.message.senderId !== this.currentUserId();
        if (fromOther && document.visibilityState === 'visible' && this.isNearBottom()) {
          this.markRead(event.message.id);
        }
        break;
      }
      case 'message-deleted':
        this.applyDeleted(event.messageId);
        break;
      case 'read':
        if (event.userId !== this.currentUserId()) {
          this.otherLastReadId.set(event.lastReadMessageId);
        }
        break;
      default:
        break;
    }
  }

  /** Inserta sin duplicar (el envío propio llega por REST y por SSE). */
  private addMessage(message: ChatMessageDto): boolean {
    let added = false;
    this.messages.update((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      added = true;
      return [...current, message].sort(
        (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)
      );
    });

    if (added) {
      this.patchThreadPreview(message);
      if (message.senderId === this.currentUserId() || this.isNearBottom()) {
        this.scrollToBottom('smooth');
      }
    }

    return added;
  }

  private patchThreadPreview(message: ChatMessageDto): void {
    this.thread.update((thread) =>
      thread
        ? {
            ...thread,
            lastMessage: {
              id: message.id,
              kind: message.kind,
              preview: message.kind === 'IMAGE' ? null : message.content,
              senderId: message.senderId,
              createdAt: message.createdAt,
            },
            lastMessageAt: message.createdAt,
          }
        : thread
    );
  }

  private applyDeleted(messageId: string): void {
    this.messages.update((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, deleted: true, content: null, attachment: null }
          : message
      )
    );
  }

  // ── Lectura ─────────────────────────────────────────────────────────

  private markLatestAsRead(): void {
    const messages = this.messages();
    const last = messages[messages.length - 1];
    if (last) this.markRead(last.id);
  }

  private markRead(messageId: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId || messageId === this.lastMarkedReadId) return;

    this.lastMarkedReadId = messageId;
    this.chatMessages.markRead(tenantId, threadId, messageId).subscribe({
      next: () => {
        this.thread.update((thread) => (thread ? { ...thread, unreadCount: 0 } : thread));
        this.chatUnread.refresh();
      },
      // Si falla, se permite reintentar con el mismo mensaje en el próximo evento.
      error: () => {
        if (this.lastMarkedReadId === messageId) this.lastMarkedReadId = null;
      },
    });
  }

  // ── Acciones ────────────────────────────────────────────────────────

  sendText(text: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId || this.sending()) return;

    this.sending.set(true);
    this.chatMessages.send(tenantId, threadId, { content: text }).subscribe({
      next: (message) => {
        this.sending.set(false);
        this.composer()?.clear();
        this.addMessage(message);
      },
      error: () => this.sending.set(false),
    });
  }

  sendImage(file: File): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId || this.sending()) return;

    this.sending.set(true);
    this.chatMessages.send(tenantId, threadId, { file }).subscribe({
      next: (message) => {
        this.sending.set(false);
        this.addMessage(message);
      },
      error: () => this.sending.set(false),
    });
  }

  refreshAttachment(attachmentId: string): void {
    const tenantId = this.tenantCtx.currentTenantId();
    if (!tenantId) return;

    this.chatMessages.refreshAttachmentUrl(tenantId, attachmentId).subscribe({
      next: (attachment) => {
        this.messages.update((current) =>
          current.map((message) =>
            message.attachment?.id === attachment.id ? { ...message, attachment } : message
          )
        );
      },
    });
  }

  confirmDelete(message: ChatMessageDto): void {
    const tenantId = this.tenantCtx.currentTenantId();
    const threadId = this.threadId();
    if (!tenantId || !threadId) return;

    this.confirm
      .confirm({
        label: this.transloco.translate('common.attention'),
        content: this.transloco.translate('chat.delete_confirm'),
        yes: this.transloco.translate('common.delete'),
        no: this.transloco.translate('common.cancel'),
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.chatMessages.delete(tenantId, threadId, message.id).subscribe({
          next: () => this.applyDeleted(message.id),
        });
      });
  }

  confirmArchive(): void {
    const thread = this.thread();
    const tenantId = this.tenantCtx.currentTenantId();
    if (!thread || !tenantId || this.archiving()) return;

    const archived = !thread.archived;
    this.archiving.set(true);
    this.chatThreads.archive(tenantId, thread.id, archived).subscribe({
      next: () => {
        this.archiving.set(false);
        this.thread.update((current) => (current ? { ...current, archived } : current));
        this.notify.success(
          this.transloco.translate(archived ? 'chat.archived_success' : 'chat.unarchived_success')
        );
        this.chatUnread.refresh();
      },
      error: () => this.archiving.set(false),
    });
  }

  unarchive(): void {
    if (this.thread()?.archived) this.confirmArchive();
  }

  // ── Utilidades de vista ─────────────────────────────────────────────

  isRead(message: ChatMessageDto, index: number): boolean {
    const through = this.readThroughIndex();
    return through >= 0 && index <= through;
  }

  isNewDay(previous: ChatMessageDto | undefined, current: ChatMessageDto): boolean {
    if (!previous) return true;
    return new Date(previous.createdAt).toDateString() !== new Date(current.createdAt).toDateString();
  }

  /** ¿El usuario está mirando el final del hilo? Si no, no se le mueve el scroll. */
  private isNearBottom(): boolean {
    const host = this.scrollHost()?.nativeElement;
    if (!host) return true;
    return host.scrollHeight - host.scrollTop - host.clientHeight < STICK_TO_BOTTOM_PX;
  }

  private scrollToBottom(behavior: ScrollBehavior): void {
    requestAnimationFrame(() => {
      const host = this.scrollHost()?.nativeElement;
      if (!host) return;
      const reduced = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      host.scrollTo({ top: host.scrollHeight, behavior: reduced ? 'auto' : behavior });
    });
  }
}
