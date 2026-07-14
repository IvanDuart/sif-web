import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl bg-surface-50 dark:bg-surface-800/50">
      <div class="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <i [class]="icon() + ' text-3xl text-primary-500'"></i>
      </div>
      <h3 class="text-xl font-bold mb-2 text-surface-900 dark:text-surface-0">{{ title() }}</h3>
      <p class="text-surface-500 mb-6 max-w-md">{{ description() }}</p>
      @if (actionLabel()) {
        <button type="button" class="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-600 transition-colors" (click)="action.emit()">
          <i [class]="actionIcon()"></i>
          {{ actionLabel() }}
        </button>
      }
    </div>
  `
})
export class EmptyState {
  icon = input('fa-solid fa-inbox');
  title = input.required<string>();
  description = input.required<string>();
  actionLabel = input<string>();
  actionIcon = input('fa-solid fa-plus');
  action = output<void>();
}
