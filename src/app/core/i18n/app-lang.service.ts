import { Injectable, inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
export class AppLangService {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    // El atributo `lang` del documento debe seguir al idioma activo: con un
    // centro en inglés, `<html lang="es">` hace que el lector de pantalla
    // pronuncie el contenido con la fonética equivocada (WCAG 3.1.1).
    this.applyDocumentLang(this.transloco.getActiveLang());
    this.transloco.langChanges$.subscribe((lang) => this.applyDocumentLang(lang));
  }

  setLang(lang: string) {
    localStorage.setItem('preferredLanguage', lang);
    this.transloco.setActiveLang(lang);
    this.applyDocumentLang(lang);
  }

  resolveInitialLang(brandingDefault?: string): string {
    return localStorage.getItem('preferredLanguage') ?? brandingDefault ?? 'es';
  }

  private applyDocumentLang(lang: string): void {
    if (lang) document.documentElement.lang = lang;
  }
}
