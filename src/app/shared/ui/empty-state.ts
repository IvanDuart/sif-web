import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, Button],
  template: `
    <div class="flex flex-col items-center justify-center p-8 md:p-12 text-center rounded-xl bg-surface-50 dark:bg-surface-800 border border-dashed border-surface-200 dark:border-surface-700">
      <div class="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
        <i [class]="icon + ' text-3xl text-primary-500'"></i>
      </div>
      <h3 class="text-xl font-bold mb-2 text-surface-900 dark:text-surface-0">{{ title }}</h3>
      <p class="text-surface-500 mb-6 max-w-md">{{ description }}</p>
      <p-button *ngIf="actionLabel" [label]="actionLabel" [icon]="actionIcon" (onClick)="action.emit()"></p-button>
    </div>
  `
})
export class EmptyState {
  @Input() icon = 'fa-solid fa-inbox';
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input() actionLabel?: string;
  @Input() actionIcon = 'fa-solid fa-plus';
  @Output() action = new EventEmitter<void>();
}
