import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-tenant-logo',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (logoUrl()) {
      @if (!imageError) {
        <img [src]="logoUrl()" alt="Tenant Logo" [class]="imgClass" (error)="imageError = true" />
      }
    } @else if (showPlaceholder) {
      <div [class]="placeholderClass + ' flex items-center justify-center bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 font-bold'">
        {{ fallbackText }}
      </div>
    }
  `
})
export class TenantLogo implements OnInit {
  @Input() imgClass = 'h-10 object-contain';
  @Input() placeholderClass = 'w-10 h-10 rounded-lg text-lg';
  @Input() showPlaceholder = true;
  @Input() fallbackText = 'S';

  private brandingService = inject(TenantBrandingService);
  private tenantCtx = inject(TenantContextService);
  
  logoUrl = signal<string | null>(null);
  imageError = false;

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      // Fast fallback to branding URL assuming the endpoint is /api/tenant/{id}/branding/logo
      // Usually we get logoUrl from getBranding, but if it returns a URL or stream we can point directly
      this.logoUrl.set('/api/tenant/' + tenantId + '/branding/logo');
    }
  }
}
