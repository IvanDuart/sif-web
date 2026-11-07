import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';

import { CatalogDebug } from '../copilot/catalog-debug';
import { ToolRunnerService } from '../copilot/tool-runner.service';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { MascotActionCard } from '../components/mascot-action-card';
import { MascotRichText } from '../components/mascot-rich-text';
import { MascotStateService } from '../mascot-state.service';
import { dockPoint, publishDock } from './bar-dock';
import { stripKind } from './strip-kind';

/** Lo que crece el campo antes de hacer scroll (4 líneas). */
const MAX_INPUT_PX = 92;

/**
 * La barra de abajo: una sola tarjeta con la mascota montada sobre su borde
 * izquierdo.
 *
 * Sustituye al panel flotante, que tapaba justo la pantalla en la que la
 * mascota trabaja. Y es **una** tarjeta, no una barra con cosas encima: lo que
 * dice, lo que hay que contestarle y dónde se le escribe son el mismo sitio,
 * porque son la misma conversación. En reposo se encoge a una pastilla con
 * solo el campo.
 *
 * La mascota **no se pinta aquí**: es el FAB de siempre, que se acopla a este
 * borde izquierdo (`--mascot-card-w`). Así sigue siendo una sola mascota en
 * pantalla, con su viaje a los campos, sus notas y su arrastre, y la tarjeta
 * se limita a dejarle el hueco.
 */
@Component({
  selector: 'app-mascot-bar',
  standalone: true,
  imports: [CatalogDebug, FormsModule, TranslocoDirective, MascotActionCard, MascotRichText],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mascot-bar.html',
  styleUrl: './mascot-bar.scss',
})
export class MascotBar {
  readonly state = inject(MascotStateService);
  private readonly fill = inject(MascotFillService);
  private readonly runner = inject(ToolRunnerService);
  private readonly transloco = inject(TranslocoService);

  protected readonly text = signal('');
  /** El historial, abierto a mano desde la mascota. */
  protected readonly trayOpen = signal(false);
  /** Lo que ya se cerró con la ✕: no vuelve solo. */
  private readonly dismissed = signal('');

  private readonly input = viewChild<ElementRef<HTMLTextAreaElement>>('input');
  private readonly card = viewChild<ElementRef<HTMLElement>>('card');
  /**
   * La fila a la que se acopla la mascota: SIEMPRE la de escribir.
   *
   * La tarjeta está anclada abajo y crece hacia arriba, así que esta fila es
   * la única que no se mueve. Acoplarse a lo que dice —como hace alkimia—
   * dejaba a la mascota subiendo y bajando con cada respuesta, y una mascota
   * que da saltos cada vez que contesta cansa de mirar.
   */
  private readonly inputRow = viewChild<ElementRef<HTMLElement>>('inputRow');

  /** Lo último que dijo la mascota. */
  private readonly reply = computed(() => {
    const messages = this.state.messages();
    for (let at = messages.length - 1; at >= 0; at -= 1) {
      if (messages[at].role === 'ASSISTANT') return messages[at].content;
    }
    return '';
  });

  protected readonly kind = computed(() =>
    stripKind({
      question: this.state.questions.current(),
      paused: this.state.cursor.paused(),
      acting: this.runner.running() !== null,
      sending: this.state.sending(),
      reply: this.reply(),
    }),
  );

  protected readonly working = computed(() => this.state.sending());
  protected readonly asking = computed(() => this.kind() === 'confirm' || this.kind() === 'choice');
  protected readonly dangerous = computed(() => this.state.questions.current()?.dangerous === true);
  protected readonly options = computed(() => this.state.questions.current()?.options ?? []);

  /**
   * Lo que la tarjeta enseña escrito: la pregunta si hay una, y si no lo
   * último que dijo. Entero, no recortado a una línea: la tarjeta crece.
   */
  protected readonly said = computed(() => {
    const question = this.state.questions.current();
    if (question) return question.text;
    const reply = this.reply();
    return reply === this.dismissed() ? '' : reply;
  });

  /** Lo que está haciendo ahora mismo, con sus palabras si las tiene. */
  protected readonly doingText = computed(() => {
    if (this.state.cursor.paused()) return this.transloco.translate('assistant.paused');
    const saying = this.fill.saying();
    if (saying) return this.transloco.translate(saying.key, saying.values ?? {});
    if (this.runner.running()) return this.transloco.translate('assistant.tool_running');
    return this.transloco.translate('assistant.thinking');
  });

  /**
   * Mientras trabaja, lo que se escribe se encola. El campo lo dice, porque si
   * no parece que se esté perdiendo.
   */
  protected readonly placeholder = computed(() =>
    this.transloco.translate(this.working() ? 'assistant.queue_placeholder' : 'assistant.placeholder'),
  );

  /** En reposo y sin nada que contar, la tarjeta se encoge a una pastilla. */
  protected readonly pill = computed(
    () =>
      !this.working() &&
      !this.asking() &&
      this.said() === '' &&
      this.state.pendingAction() === null &&
      this.state.queued().length === 0,
  );

  protected readonly canSend = computed(() => this.text().trim() !== '' || this.state.attachment() !== null);

  protected readonly history = computed(() => this.state.messages());

  constructor() {
    // La tarjeta cambia de alto con lo que lleve dentro, así que se mide cada
    // vez en vez de deducirlo: una mascota colocada con constantes se queda
    // flotando fuera en cuanto aparece una fila nueva.
    const measure = () => {
      const card = this.card()?.nativeElement;
      const row = this.inputRow()?.nativeElement;
      if (!card || !row) return publishDock(null);
      publishDock(
        // `clientWidth`, no `innerWidth`: éste último cuenta la barra de
        // desplazamiento, y un `position: fixed` con `right` no. Son los 15 px
        // que dejaban a la mascota al lado del borde en vez de encima.
        dockPoint(card.getBoundingClientRect(), row.getBoundingClientRect(), {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        }),
      );
    };

    afterRenderEffect(() => {
      // Leerlos aquí es lo que hace que se vuelva a medir cuando cambian: lo
      // que la tarjeta lleva dentro es justo lo que le cambia el alto.
      const watched = [this.kind(), this.said(), this.state.queued().length, this.pill()];
      if (watched.length > 0) measure();
    });

    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('resize', onResize);
      publishDock(null);
    });
  }

  protected grow(): void {
    const area = this.input()?.nativeElement;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, MAX_INPUT_PX)}px`;
  }

  protected submit(): void {
    if (!this.canSend()) return;
    const value = this.text().trim();
    this.text.set('');
    this.state.send(value);
    queueMicrotask(() => this.grow());
  }

  /** Enter envía, Shift+Enter hace un salto de línea. */
  protected onKey(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.submit();
  }

  protected answer(value: string): void {
    this.state.questions.answer(value);
  }

  protected decline(): void {
    this.state.questions.decline();
  }

  /**
   * Cerrar lo que dijo. Una pregunta sin contestar NO se cierra así: cerrarla
   * dejaría el turno esperando una respuesta que ya nadie puede dar.
   */
  protected dismiss(): void {
    if (this.state.questions.current()) {
      this.decline();
      return;
    }
    this.dismissed.set(this.reply());
  }

  /** Plegar la tarjeta y dejar sólo la mascota en su esquina. */
  protected hide(): void {
    this.dismissed.set(this.reply());
    this.state.closePanel();
  }

  protected toggleTray(): void {
    this.trayOpen.update((open) => !open);
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.state.attach(file);
    input.value = '';
  }
}
