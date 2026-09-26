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
          <div class="overflow-hidden rounded-md border border-line bg-surface-0 dark:bg-surface-800">
            <!-- Header -->
            <button
              type="button"
              (click)="toggleTopic(topic.id)"
              class="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-surface-50 dark:hover:bg-surface-700"
              [attr.aria-expanded]="isTopicOpen(topic.id)"
            >
              <i
                class="fa-solid text-xs text-surface-400 transition-transform duration-200"
                [class.fa-chevron-down]="!isTopicOpen(topic.id)"
                [class.fa-chevron-up]="isTopicOpen(topic.id)"
                aria-hidden="true"
              ></i>
              <span class="flex-1 font-medium text-surface-900 dark:text-surface-0">
                {{ t(topic.titleKey) }}
              </span>
            </button>

            <!-- Content -->
            @if (isTopicOpen(topic.id)) {
              <div class="space-y-4 border-t border-line bg-surface-50 px-5 pb-5 pt-4 dark:bg-surface-900">
                <!-- Description -->
                <p class="text-[14px] leading-relaxed text-surface-600 dark:text-surface-300">
                  {{ t(topic.descKey) }}
                </p>

                <!-- Steps (if available) -->
                @if (topic.steps && topic.steps.length > 0) {
                  <div class="rounded-sm border border-line bg-surface-0 p-4 dark:bg-surface-800">
                    <h3 class="mb-2 text-[13px] font-semibold text-surface-900 dark:text-surface-0">
                      {{ t('help.steps_label') }}
                    </h3>
                    <ol class="list-inside list-decimal space-y-1.5">
                      @for (step of topic.steps; track step; let i = $index) {
                        <li class="text-[14px] leading-relaxed text-surface-700 dark:text-surface-200">
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
                        class="inline-flex items-center gap-1.5 rounded-pill bg-brand-tint-10 px-3 py-1.5 text-xs font-medium text-primary-700 transition-colors hover:bg-brand-tint-20 dark:text-primary-300"
                      >
                        <i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>
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

