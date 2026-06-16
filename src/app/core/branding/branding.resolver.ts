import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { TenantBrandingService } from '../api/services/tenant-branding.api';
import { ThemeService } from './theme.service';
import { AppLangService } from '../i18n/app-lang.service';
import { TenantBrandingDto } from '../api/models/branding.model';
import { tap, EMPTY } from 'rxjs';
import { AuthService } from '../auth/auth.service';

export const brandingResolver: ResolveFn<TenantBrandingDto | null> = () => {
  const api = inject(TenantBrandingService);
  const themeService = inject(ThemeService);
  const appLangService = inject(AppLangService);
  const authService = inject(AuthService);

  const tenantId = authService.selectedTenant()?.tenantId;
  
  if (!tenantId) {
    return EMPTY;
  }

  return api.getBranding(tenantId).pipe(
    tap(branding => {
      if (branding.primaryColor) {
        themeService.setPrimary(branding.primaryColor);
      }
      const finalLang = appLangService.resolveInitialLang(branding.defaultLanguage);
      appLangService.setLang(finalLang);
    })
  );
};
