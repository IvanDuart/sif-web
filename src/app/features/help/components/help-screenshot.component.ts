import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help-screenshot',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="help-screenshot">
      <picture>
        <!-- Dark mode screenshot (if prefers-color-scheme: dark) -->
        <source 
          [srcset]="getDarkSrc()"
          media="(prefers-color-scheme: dark)" 
          type="image/png"
        />
        <!-- Light mode screenshot (default) -->
        <img
          [src]="getLightSrc()"
          [alt]="alt"
          loading="lazy"
          class="w-full rounded-lg border border-surface-200 dark:border-surface-700 shadow-md hover:shadow-lg transition-shadow cursor-zoom-in"
          (error)="onImageError($event)"
        />
      </picture>

      <!-- Fallback message if image fails to load -->
      @if (hasImageError) {
        <div class="bg-surface-100 dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg p-4 text-center">
          <i class="fa-solid fa-image-slash text-2xl text-surface-400 dark:text-surface-500 mb-2 block"></i>
          <p class="text-sm text-surface-600 dark:text-surface-300">
            Screenshot not available
          </p>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .help-screenshot {
      img {
        display: block;
        max-width: 100%;
        height: auto;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpScreenshotComponent {
  @Input() screenshot!: { light: string; dark: string };
  @Input() alt = 'Help screenshot';
  hasImageError = false;

  getLightSrc(): string {
    return `assets/help/screenshots/${this.screenshot.light}`;
  }

  getDarkSrc(): string {
    return `assets/help/screenshots/${this.screenshot.dark}`;
  }

  onImageError(event: Event): void {
    this.hasImageError = true;
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
}

