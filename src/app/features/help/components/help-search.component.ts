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
        <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 dark:text-surface-500"></i>
        <input
          type="text"
          class="w-full pl-10 pr-10 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 text-surface-900 dark:text-surface-0 placeholder-surface-400 dark:placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          [value]="query"
          [placeholder]="placeholder"
          (input)="onInput($event)"
          (keydown.escape)="onEscape()"
          aria-label="Search help"
        />
        @if (query.length > 0) {
          <button
            type="button"
            (click)="onClear()"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:text-surface-500 dark:hover:text-surface-300 transition-colors"
            aria-label="Clear search"
          >
            <i class="fa-solid fa-xmark"></i>
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

