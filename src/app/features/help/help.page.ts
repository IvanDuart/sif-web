import { Component, ChangeDetectionStrategy, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { TenantContextService } from '../../core/tenant/tenant-context.service';
import { HELP_CONTENT, HelpSection } from './content/help-content';
import { HelpSearchComponent } from './components/help-search.component';
import { HelpAccordionComponent } from './components/help-accordion.component';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TranslocoModule,
    HelpSearchComponent,
    HelpAccordionComponent,
  ],
  templateUrl: './help.page.html',
  styleUrls: ['./help.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class HelpPage {
  private readonly tenantCtx = inject(TenantContextService);
  private readonly transloco = inject(TranslocoService);

  // ========== Signals ==========

  /**
   * Current active tab ID
   */
  readonly activeTab = signal<string>('common');

  /**
   * Search query input
   */
  readonly searchQuery = signal<string>('');

  // ========== Computed Signals ==========

  /**
   * Determine if user is nutritionist or patient based on user type
   */
  readonly userRole = computed<'nutritionist' | 'patient'>(() => {
    const membership = this.tenantCtx.currentMembership();
    return membership?.userType === 'STAFF' ? 'nutritionist' : 'patient';
  });

  /**
   * Dynamic tabs based on role
   * Nutritionist sees: Common, Nutritionist, Patient
   * Patient sees: Common, Patient
   */
  readonly tabs = computed(() => {
    const role = this.userRole();
    const base = [
      { id: 'common', label: this.transloco.translate('help.common'), icon: 'fa-solid fa-book' },
    ];

    if (role === 'nutritionist') {
      return [
        ...base,
        { id: 'nutritionist', label: this.transloco.translate('help.nutritionist'), icon: 'fa-solid fa-user-doctor' },
        { id: 'patient', label: this.transloco.translate('help.patient_for_nutri'), icon: 'fa-solid fa-user-injured' },
      ];
    }

    return [
      ...base,
      { id: 'patient', label: this.transloco.translate('help.patient'), icon: 'fa-solid fa-user-injured' },
    ];
  });

  /**
   * Filter sections by current role and active tab
   * Then apply search filter
   */
  readonly filteredSections = computed<HelpSection[]>(() => {
    const activeTab = this.activeTab();
    const role = this.userRole();
    const searchQ = this.searchQuery().toLowerCase().trim();

    // Filter by role and tab
    const sections = HELP_CONTENT.filter(section => {
      const canSeeSection = section.roles.includes(role) || section.roles.includes('common');
      const isInActiveTab =
        activeTab === 'common'
          ? section.roles.includes('common')
          : section.roles.some(r => r === activeTab || (r !== 'common' && activeTab !== 'common'));

      return canSeeSection && isInActiveTab;
    }).sort((a, b) => a.order - b.order);

    // Apply search filter if query exists
    if (!searchQ) {
      return sections;
    }

    return sections
      .map(section => ({
        ...section,
        topics: section.topics.filter(topic => {
          const titleText = this.transloco.translate(topic.titleKey).toLowerCase();
          const descText = this.transloco.translate(topic.descKey).toLowerCase();
          const tagsText = (topic.tags || []).join(' ').toLowerCase();

          return (
            titleText.includes(searchQ) ||
            descText.includes(searchQ) ||
            tagsText.includes(searchQ)
          );
        }),
      }))
      .filter(section => section.topics.length > 0);
  });

  /**
   * Check if search returned no results
   */
  readonly hasNoResults = computed(() => {
    return this.searchQuery().trim().length > 0 && this.filteredSections().length === 0;
  });

  // ========== Event Handlers ==========

  /**
   * Handle tab change
   */
  onTabChange(tabId: string): void {
    this.activeTab.set(tabId);
    // Reset search when changing tab for cleaner UX
    this.searchQuery.set('');
  }

  /**
   * Handle search query change (called from HelpSearchComponent)
   */
  onSearchChange(query: string): void {
    this.searchQuery.set(query);
  }

  /**
   * Handle accordion section open (for potential analytics later)
   */
  onSectionOpen(sectionId: string): void {
    console.log(`Help section opened: ${sectionId}`);
    // TODO: Add analytics event tracking here if needed
  }
}

