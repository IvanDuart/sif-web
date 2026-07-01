import { Injectable, signal } from '@angular/core';

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
    document.documentElement.style.setProperty('--p-primary-500', hex);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const darken = (factor: number) =>
      `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
    document.documentElement.style.setProperty('--p-primary-50', `rgba(${r}, ${g}, ${b}, 0.1)`);
    document.documentElement.style.setProperty('--p-primary-300', darken(0.7));
    document.documentElement.style.setProperty('--p-primary-600', darken(0.8));
    document.documentElement.style.setProperty('--p-primary-700', darken(0.6));

    document.documentElement.style.setProperty('--tui-primary', hex);
    document.documentElement.style.setProperty('--tui-primary-hover', darken(0.8));
    document.documentElement.style.setProperty('--tui-background-accent-1', hex);
    document.documentElement.style.setProperty('--tui-background-accent-1-hover', darken(0.8));
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
