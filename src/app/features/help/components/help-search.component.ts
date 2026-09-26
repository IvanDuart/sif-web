import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-help-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="help-search relative w-full lg:w-80">
      <div class="relative">
        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500" aria-hidden="true"></i>
        <input
          type="text"
          class="w-full rounded-sm border border-line bg-surface-0 py-2 pl-10 pr-10 text-surface-900 transition-colors placeholder:text-surface-400 focus:border-primary-600 focus:outline-none dark:bg-surface-800 dark:text-surface-0 dark:focus:border-primary-300"
          [value]="query"
          [placeholder]="placeholder"
          (input)="onInput($event)"
          (keydown.escape)="onEscape()"
          [attr.aria-label]="placeholder"
        />
        @if (query.length > 0) {
          <button
            type="button"
            (click)="onClear()"
            class="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 transition-colors hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300"
            [attr.aria-label]="clearLabel"
          >
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpSearchComponent {
  @Input() query = '';
  @Input() placeholder = 'Search help...';
  @Input() clearLabel = 'Clear search';
  @Output() queryChange = new EventEmitter<string>();

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.queryChange.emit(input.value);
  }

  onClear(): void {
    this.queryChange.emit('');
  }

  onEscape(): void {
    this.queryChange.emit('');
  }
}

