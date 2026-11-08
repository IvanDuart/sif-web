import { Injectable, inject, signal } from '@angular/core';
import { TUI_DARK_MODE } from '@taiga-ui/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly tuiDarkMode = inject(TUI_DARK_MODE);

  colorScheme = signal<'light' | 'dark'>('light');

  init() {
    const saved = localStorage.getItem('colorScheme') ?? localStorage.getItem('tuiDark');
    if (saved === 'dark' || saved === 'light' || saved === 'true' || saved === 'false') {
      const isDarkSaved = saved === 'dark' || saved === 'true';
      this.colorScheme.set(isDarkSaved ? 'dark' : 'light');
    } else if (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) {
      this.colorScheme.set('dark');
    }
    this.applyColorScheme();
  }

  /**
   * Single source of truth for the accent: the tenant's primary color.
   * Writes ONLY the anchor (--brand-primary) and the computed contrast color;
   * the full 50-950 ramp + Taiga tokens + dark variants are derived in CSS via
   * color-mix(), so dark mode and every shade stay in sync automatically.
   */
  setPrimary(hex: string) {
    if (!/^#([0-9a-fA-F]{6})$/.test(hex)) return;
    const root = document.documentElement.style;
    root.setProperty('--brand-primary', hex);
    root.setProperty('--p-primary-contrast-color', this.contrastColor(hex));
    // El acento como TEXTO se recalcula por tema: un mix fijo no garantiza
    // 4.5:1 sobre el tint suave cuando el color del centro es claro (amarillo,
    // lima…). Se oscurece/aclara la marca hasta alcanzar AA.
    root.setProperty(
      '--accent-text-light',
      this.ensureContrast(hex, this.mix('#ffffff', hex, 0.1), '#000000'),
    );
    root.setProperty(
      '--accent-text-dark',
      this.ensureContrast(hex, this.mix('#232120', hex, 0.22), '#ffffff'),
    );
  }

  /** WCAG-style: pick white or near-black (surface-950) for text on the primary. */
  private contrastColor(hex: string): string {
    const white = this.contrastRatio(hex, '#ffffff');
    const dark = this.contrastRatio(hex, '#0f172a');
    // Contraste real contra blanco y contra near-black. Antes las dos
    // fórmulas estaban invertidas y siempre devolvían #0f172a: con la marca
    // verde por defecto eso dejaba 2.38:1 en avatares y chips.
    return white >= dark ? '#ffffff' : '#0f172a';
  }

  /** Luminancia relativa WCAG de un color #rrggbb. */
  private luminance(hex: string): number {
    const n = parseInt(hex.slice(1), 16);
    const lin = (c: number) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }

  private contrastRatio(a: string, b: string): number {
    const la = this.luminance(a);
    const lb = this.luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Mezcla `t` partes de `to` en `from` (t = 0 → from, t = 1 → to). */
  private mix(from: string, to: string, t: number): string {
    const f = parseInt(from.slice(1), 16);
    const o = parseInt(to.slice(1), 16);
    const channel = (shift: number) =>
      Math.round((((f >> shift) & 255) * (1 - t)) + (((o >> shift) & 255) * t));
    return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
  }

  /** Acerca `hex` hacia negro/blanco hasta que alcance AA (4.6:1, con margen). */
  private ensureContrast(
    hex: string,
    background: string,
    toward: '#000000' | '#ffffff',
  ): string {
    for (let t = 0.25; t <= 0.95; t += 0.05) {
      const candidate = this.mix(hex, toward, t);
      if (this.contrastRatio(candidate, background) >= 4.6) return candidate;
    }
    return toward;
  }

  toggleColorScheme() {
    const next = this.colorScheme() === 'light' ? 'dark' : 'light';
    const apply = () => {
      this.colorScheme.set(next);
      localStorage.setItem('colorScheme', next);
      this.applyColorScheme();
    };

    const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || typeof document.startViewTransition !== 'function') {
      apply();
      return;
    }
    document.startViewTransition(apply);
  }

  private applyColorScheme() {
    const isDark = this.colorScheme() === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    this.tuiDarkMode.set(isDark);
  }
}
