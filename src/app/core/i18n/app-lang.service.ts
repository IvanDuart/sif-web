import { Injectable, inject, DestroyRef } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { PrimeNG } from 'primeng/config';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Injectable({ providedIn: 'root' })
export class AppLangService {
  private readonly transloco = inject(TranslocoService);
  private readonly primeng = inject(PrimeNG);

  constructor() {
    this.transloco.selectTranslateObject('primeng')
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(translation => {
        if (translation && Object.keys(translation).length) {
          this.primeng.setTranslation(translation);
        }
      });
  }

  setLang(lang: string) {
    localStorage.setItem('preferredLanguage', lang);
    this.transloco.setActiveLang(lang);
  }

  resolveInitialLang(brandingDefault?: string): string {
    return localStorage.getItem('preferredLanguage') ?? brandingDefault ?? 'es';
  }
}
