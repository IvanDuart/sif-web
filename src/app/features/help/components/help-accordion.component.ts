import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { HelpSection } from '../content/help-content';

@Component({
  selector: 'app-help-accordion',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="help-accordion" *transloco="let t">
      <div class="space-y-2">
        @for (topic of section.topics; track topic.id) {
          <div class="border border-surface-200 dark:border-surface-700 rounded-lg overflow-hidden bg-surface-0 dark:bg-surface-800">
            <!-- Header -->
            <button
              type="button"
              (click)="toggleTopic(topic.id)"
              class="w-full px-6 py-4 flex items-start gap-3 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors text-left"
              [attr.aria-expanded]="isTopicOpen(topic.id)"
            >
              <i
                class="fa-solid transition-transform duration-200"
                [class.fa-chevron-down]="!isTopicOpen(topic.id)"
                [class.fa-chevron-up]="isTopicOpen(topic.id)"
              ></i>
              <div class="flex-1">
                <h4 class="font-semibold text-surface-900 dark:text-surface-0">
                  {{ t(topic.titleKey) }}
                </h4>
              </div>
            </button>

            <!-- Content -->
            @if (isTopicOpen(topic.id)) {
              <div class="px-6 pb-4 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-200 dark:border-surface-700 space-y-4">
                <!-- Description -->
                <p class="text-surface-600 dark:text-surface-300 text-sm leading-relaxed">
                  {{ t(topic.descKey) }}
                </p>

                <!-- Steps (if available) -->
                @if (topic.steps && topic.steps.length > 0) {
                  <div class="bg-surface-0 dark:bg-surface-800 rounded-lg p-4 border border-surface-200 dark:border-surface-700">
                    <h5 class="font-semibold text-surface-900 dark:text-surface-0 mb-3 text-sm">
                      {{ t('help.steps_label') }}
                    </h5>
                    <ol class="space-y-2 list-decimal list-inside">
                      @for (step of topic.steps; track step; let i = $index) {
                        <li class="text-surface-700 dark:text-surface-200 text-sm leading-relaxed">
                          {{ t(step) }}
                        </li>
                      }
                    </ol>
                  </div>
                }

                <!-- Related Routes (if available) -->
                @if (topic.relatedRoutes && topic.relatedRoutes.length > 0) {
                  <div class="flex flex-wrap gap-2">
                    @for (route of topic.relatedRoutes; track route) {
                      <a
                        [routerLink]="route"
                        class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-medium hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
                      >
                        <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        {{ t('help.go_to_app') }}
                      </a>
                    }
                  </div>
                }
              </div>
            }
          </div>
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
export class HelpAccordionComponent {
  @Input() section!: HelpSection;
  @Input() deepLinkId?: string;
  @Output() openSection = new EventEmitter<string>();

  private readonly transloco = inject(TranslocoService);
  readonly openTopics = signal<Set<string>>(new Set());

  isTopicOpen(topicId: string): boolean {
    return this.openTopics().has(topicId);
  }

  toggleTopic(topicId: string): void {
    const current = this.openTopics();
    const updated = new Set(current);
    if (updated.has(topicId)) {
      updated.delete(topicId);
    } else {
      updated.add(topicId);
    }
    this.openTopics.set(updated);
    this.openSection.emit(topicId);
    // Update URL fragment for deep linking
    window.history.replaceState({}, '', `#${this.deepLinkId}-${topicId}`);
  }
}

