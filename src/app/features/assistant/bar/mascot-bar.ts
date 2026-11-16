import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';

import { PermissionsService } from '../../../core/permissions/permissions.service';
import { CatalogDebug } from '../copilot/catalog-debug';
import { FirstStepsService, firstStepsForUrl, type FirstStep } from '../copilot/first-steps';
import { ToolRunnerService } from '../copilot/tool-runner.service';
import { MascotFillService } from '../mascot/fill/mascot-fill.service';
import { overlapsBar, type Box } from '../mascot/placement';
import { MascotActionCard } from '../components/mascot-action-card';
import { MascotRichText } from '../components/mascot-rich-text';
import { MascotStateService } from '../mascot-state.service';
import { dockPoint, publishDock } from './bar-dock';
import { stripKind } from './strip-kind';

/** Lo que crece el campo antes de hacer scroll (4 líneas). */
const MAX_INPUT_PX = 92;

function boxOf(element: HTMLElement): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
}

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
  host: {
    '[class.is-compact]': 'compact()',
  },
  templateUrl: './mascot-bar.html',
  styleUrl: './mascot-bar.scss',
})
export class MascotBar {
  readonly state = inject(MascotStateService);
  private readonly fill = inject(MascotFillService);
  private readonly runner = inject(ToolRunnerService);
  private readonly transloco = inject(TranslocoService);
  private readonly firstStepsService = inject(FirstStepsService);
  private readonly permissions = inject(PermissionsService);
  private readonly router = inject(Router);

  /** La pantalla en la que está la persona: sus ofertas cambian con ella. */
  private readonly url = signal(this.router.url);

  /**
   * Lo que se le puede pedir la primera vez, si es la primera vez.
   *
   * No es la misma lista en todas partes: en el detalle de un menú se ofrece
   * rellenarlo, y en la ficha de un paciente, apuntar una medición. Y sólo se
   * ofrece lo que esta persona puede hacer de verdad.
   */
  protected readonly firstSteps = computed(() => {
    if (!this.firstStepsService.visible()) return [];
    return firstStepsForUrl(this.url()).filter((step) => this.permissions.has(step.permission));
  });

  /**
   * Cómo se llama el botón del armario.
   *
   * `assistant.wardrobe` ya no es un texto: es el árbol con los nombres de las
   * mascotas y sus accesorios. El botón tiene su propia clave; si el idioma
   * todavía no la trae —los tests montan un Transloco mínimo—, se queda con la
   * clave de siempre, que es la que el botón ha anunciado siempre.
   */
  protected readonly wardrobeLabel = computed(() => {
    const label = this.transloco.translate('assistant.wardrobe_open');
    return label === 'assistant.wardrobe_open' ? 'assistant.wardrobe' : label;
  });

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
  private readonly doingRow = viewChild<ElementRef<HTMLElement>>('doingRow');

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

  /** El puntero o el foco están sobre la tarjeta: la fila de escribir se queda fuera. */
  protected readonly hover = signal(false);
  protected readonly focusIn = signal(false);
  /** La barra tapa el campo en el que trabaja la mascota: se encoge. */
  protected readonly compact = signal(false);
  /** Centro vertical de la fila activa dentro de la tarjeta, para el anillo punteado. */
  protected readonly dockGhostTop = signal(0);
  /** La mascota salió de su acople a trabajar: el hueco queda marcado. */
  protected readonly away = computed(() => this.fill.filling() || this.fill.target() !== null);
  /** Mientras trabaja y no la están usando, la fila de escribir se pliega. */
  protected readonly folded = computed(
    () =>
      (this.working() || this.fill.filling()) &&
      !this.asking() &&
      !this.hover() &&
      !this.focusIn() &&
      this.text().trim() === '' &&
      this.state.attachment() === null,
  );

  /** El cierre no desmonta de golpe: la tarjeta se enrolla y luego se va. */
  protected readonly barLeaving = signal(false);
  protected readonly barMounted = computed(() => this.state.barOpen() || this.barLeaving());
  private wasOpen = this.state.barOpen();
  private leaveTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * El tamaño de la tarjeta SIN encoger. `overlapsBar` debe medir siempre con
   * este ancho: si midiera con el ancho compacto, la propia compactación haría
   * que el campo dejase de solapar y la barra volvería a crecer, oscilando.
   */
  private fullSize = { width: 560, height: 0 };

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
  protected readonly placeholder = computed(() => {
    // Con una pregunta abierta en el aire, lo que se escriba ES la respuesta.
    if (this.kind() === 'choice') return this.transloco.translate('assistant.answer_placeholder');
    return this.transloco.translate(this.working() ? 'assistant.queue_placeholder' : 'assistant.placeholder');
  });

  /** En reposo y sin nada que contar, la tarjeta se encoge a una pastilla. */
  protected readonly pill = computed(
    () =>
      !this.state.consentRequired() &&
      this.greeting() === '' &&
      this.prompts().length === 0 &&
      this.firstSteps().length === 0 &&
      !this.working() &&
      !this.asking() &&
      this.said() === '' &&
      this.state.pendingAction() === null &&
      this.state.queued().length === 0,
  );

  protected readonly canSend = computed(
    () => !this.state.consentRequired() && (this.text().trim() !== '' || this.state.attachment() !== null),
  );

  /** El saludo, mientras no haya conversación que enseñar en su lugar. */
  protected readonly greeting = computed(() =>
    this.state.consentRequired() || this.state.messages().length > 0 ? '' : this.state.greeting(),
  );

  /** Lo que el centro sugiere preguntar, hasta que hay conversación. */
  protected readonly prompts = computed(() =>
    this.state.consentRequired() || this.state.messages().length > 0 ? [] : this.state.suggestedPrompts(),
  );

  protected readonly history = computed(() => this.state.messages());

  constructor() {
    // Las ofertas del estreno siguen a la ruta: cambiar de pantalla con la
    // barra abierta no debe dejar las de la pantalla anterior.
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => this.url.set(event.urlAfterRedirects));

    // La tarjeta cambia de alto con lo que lleve dentro, así que se mide cada
    // vez en vez de deducirlo: una mascota colocada con constantes se queda
    // flotando fuera en cuanto aparece una fila nueva.
    const measure = () => {
      const card = this.card()?.nativeElement;
      const activeRow = (this.folded() && this.doingRow()) || this.inputRow();
      const row = activeRow?.nativeElement;
      if (!card || !row) return publishDock(null);
      const cardRect = card.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      publishDock(
        // `clientWidth`, no `innerWidth`: éste último cuenta la barra de
        // desplazamiento, y un `position: fixed` con `right` no. Son los 15 px
        // que dejaban a la mascota al lado del borde en vez de encima.
        dockPoint(cardRect, rowRect, {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        }),
      );
      this.dockGhostTop.set(Math.round(rowRect.top + rowRect.height / 2 - cardRect.top - 22));

      // El ancho de referencia es el de la tarjeta SIN compactar. Si se midiera
      // con el actual, al encoger dejaría de solapar y volvería a crecer.
      if (!this.compact() || this.fullSize.height === 0) {
        this.fullSize = { width: cardRect.width, height: cardRect.height };
      }

      // Si la barra tapa el campo que la mascota está rellenando, se encoge
      // para no esconder justo lo que la persona tiene que mirar.
      const target = this.fill.target();
      const viewport = {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      };
      this.compact.set(
        this.working() && !!target && overlapsBar(boxOf(target), this.fullSize, viewport),
      );
    };

    afterRenderEffect(() => {
      // Leerlos aquí es lo que hace que se vuelva a medir cuando cambian: lo
      // que la tarjeta lleva dentro es justo lo que le cambia el alto.
      const watched = [
        this.kind(),
        this.said(),
        this.state.queued().length,
        this.pill(),
        this.folded(),
        this.working(),
        this.fill.target(),
        this.compact(),
      ];
      if (watched.length > 0) measure();
    });

    // Al cerrar no se desmonta en 0 ms: la tarjeta se enrolla hacia la esquina
    // (720 ms) y sólo después se retira y se suelta el punto de acople.
    effect(() => {
      const open = this.state.barOpen();
      if (open) {
        clearTimeout(this.leaveTimer);
        this.barLeaving.set(false);
        this.wasOpen = true;
        return;
      }
      if (!this.wasOpen) return;
      this.wasOpen = false;
      this.barLeaving.set(true);
      clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => {
        this.barLeaving.set(false);
        publishDock(null);
      }, this.prefersReducedMotion() ? 0 : 720);
    });

    const onResize = () => measure();
    let scrollFrame = 0;
    const onScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        measure();
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
      clearTimeout(this.leaveTimer);
      cancelAnimationFrame(scrollFrame);
      publishDock(null);
    });
  }

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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
    queueMicrotask(() => this.grow());

    // Lo que se escribe con una pregunta en el aire va a esa pregunta, como en
    // Neki. Antes iba a la cola de mensajes, y una pregunta sin opciones no
    // tenía forma de contestarse: el turno se quedaba esperando.
    const question = this.state.questions.current();
    if (question && value !== '') {
      if (question.kind === 'ask') {
        this.state.questions.answer(value);
        return;
      }
      // Escribir en vez de decir sí a una escritura es no decirle que sí. Se
      // contesta que no y lo escrito sigue como mensaje: el modelo lo lee al
      // acabar esta vuelta, con la negativa ya delante.
      this.state.questions.decline();
    }
    this.state.send(value);
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

  /** Escribe la oferta en el campo; enviarla es cosa de la persona. */
  protected useFirstStep(step: FirstStep): void {
    this.firstStepsService.dismiss();
    this.text.set(this.transloco.translate(step.promptKey));
    queueMicrotask(() => {
      this.grow();
      this.input()?.nativeElement.focus();
    });
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
