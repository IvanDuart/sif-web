import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class AppLangService {
  private transloco = inject(TranslocoService);

  setLang(lang: string) {
    localStorage.setItem('preferredLanguage', lang);
    this.transloco.setActiveLang(lang);
  }

  resolveInitialLang(brandingDefault?: string): string {
    return localStorage.getItem('preferredLanguage') ?? brandingDefault ?? 'es';
  }
}
