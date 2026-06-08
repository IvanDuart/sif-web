import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
      <div>
        <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0">{{ title }}</h1>
        <p *ngIf="description" class="text-surface-500 mt-1">{{ description }}</p>
      </div>
      <div class="flex items-center gap-2">
        <ng-content></ng-content>
      </div>
    </div>
  `
})
export class PageHeader {
  @Input({ required: true }) title!: string;
  @Input() description?: string;
}
