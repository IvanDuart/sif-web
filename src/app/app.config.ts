import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeuix/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';
import { DialogService } from 'primeng/dynamicdialog';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';
import { getKeycloakProvider } from './core/auth/keycloak.config';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

import { ThemeService } from './core/branding/theme.service';
import { InitService } from './core/auth/init.service';

function initializeApp(theme: ThemeService, initService: InitService) {
  return async () => {
    theme.init();
    // initService constructor already set up the effect for Keycloak
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor])
    ),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.dark'
        }
      }
    }),
    getKeycloakProvider(),
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      multi: true,
      deps: [ThemeService, InitService]
    },
    provideTransloco({
      config: {
        availableLangs: ['es', 'en'],
        defaultLang: localStorage.getItem('preferredLanguage') ?? 'es',
        reRenderOnLangChange: true,
        prodMode: false
      },
      loader: TranslocoHttpLoader
    }),
    MessageService,
    ConfirmationService,
    DialogService
  ]
};
