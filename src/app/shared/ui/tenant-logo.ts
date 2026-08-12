import { Component, signal, input, inject, OnInit } from '@angular/core';
import { TenantBrandingService } from '../../core/api/services/tenant-branding.api';
import { TenantContextService } from '../../core/tenant/tenant-context.service';

@Component({
  selector: 'app-tenant-logo',
  standalone: true,
  templateUrl: './tenant-logo.html'
})
export class TenantLogo implements OnInit {
  imgClass = input('h-10 object-contain');
  placeholderClass = input('w-10 h-10 rounded-lg text-lg');
  showPlaceholder = input(true);
  fallbackText = input('S');

  private readonly brandingService = inject(TenantBrandingService);
  private readonly tenantCtx = inject(TenantContextService);

  logoUrl = signal<string | null>(null);
  imageError = false;

  ngOnInit() {
    const tenantId = this.tenantCtx.currentTenantId();
    if (tenantId) {
      this.logoUrl.set('/api/tenant/' + tenantId + '/branding/logo');
    }
  }
}
