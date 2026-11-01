import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { parseRichText } from './rich-text.parse';

/**
 * Pinta el texto del asistente con el markdown mínimo que usa el modelo
 * (`**negrita**`, `*cursiva*`, `` `código` `` y saltos de línea).
 *
 * Se renderiza por tramos, nunca con `innerHTML`: el contenido llega del
 * backend/LLM y así no puede inyectar marcado.
 */
@Component({
  selector: 'app-mascot-rich-text',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (line of lines(); track $index; let first = $first) {
    @if (!first) {
      <br />
    }
    @for (segment of line; track $index) {
      @if (segment.code) {
        <code class="rich-code">{{ segment.text }}</code>
      } @else if (segment.bold && segment.italic) {
        <strong><em>{{ segment.text }}</em></strong>
      } @else if (segment.bold) {
        <strong>{{ segment.text }}</strong>
      } @else if (segment.italic) {
        <em>{{ segment.text }}</em>
      } @else {
        <span>{{ segment.text }}</span>
      }
    }
  }`,
  styles: [`
    :host { display: inline; }

    strong { font-weight: 600; }

    .rich-code {
      padding: 1px 4px;
      border-radius: 4px;
      background: var(--primary-soft, rgb(0 0 0 / 6%));
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 0.92em;
    }
  `],
})
export class MascotRichText {
  readonly text = input<string | null | undefined>('');
  protected readonly lines = computed(() => parseRichText(this.text()));
}
