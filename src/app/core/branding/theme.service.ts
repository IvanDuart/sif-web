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
    document.documentElement.style.setProperty('--brand-primary', hex);
    document.documentElement.style.setProperty('--p-primary-contrast-color', this.contrastColor(hex));
  }

  /** WCAG-style: pick white or near-black (surface-950) for text on the primary. */
  private contrastColor(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) =>
      c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    const l = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const contrastWhite = (l + 0.05) / 1.05;
    const contrastDark = 1.05 / (l + 0.05);
    return contrastWhite >= contrastDark ? '#ffffff' : '#0f172a';
  }

  toggleColorScheme() {
    const next = this.colorScheme() === 'light' ? 'dark' : 'light';
    this.colorScheme.set(next);
    localStorage.setItem('colorScheme', next);
    this.applyColorScheme();
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
