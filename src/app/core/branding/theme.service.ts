import { Injectable, signal } from '@angular/core';
import { usePreset, palette } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  colorScheme = signal<'light' | 'dark'>('light');

  init() {
    const saved = localStorage.getItem('colorScheme');
    if (saved === 'dark' || saved === 'light') {
      this.colorScheme.set(saved);
    }
    this.applyColorScheme();
  }

  setPrimary(hex: string) {
    usePreset({
      ...Aura,
      semantic: {
        ...Aura.semantic,
        primary: palette(hex)
      }
    });
  }

  toggleColorScheme() {
    const next = this.colorScheme() === 'light' ? 'dark' : 'light';
    this.colorScheme.set(next);
    localStorage.setItem('colorScheme', next);
    this.applyColorScheme();
  }

  private applyColorScheme() {
    if (this.colorScheme() === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}
