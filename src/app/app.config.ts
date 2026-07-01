import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTaiga } from '@taiga-ui/core';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';
import { TuiConfirmService } from '@taiga-ui/kit';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';
import { getKeycloakProvider } from './core/auth/keycloak.config';
import { provideTransloco } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

import { ThemeService } from './core/branding/theme.service';
import {InitService} from './core/auth/init.service';

function initializeApp(theme: ThemeService) {
  return async () => {
    theme.init();
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
    NG_EVENT_PLUGINS,
    provideTaiga({
      fontScaling: true,
      scrollbars: 'native',
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
    TuiConfirmService
  ]
};
