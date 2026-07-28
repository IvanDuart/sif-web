import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {provideTaiga, tuiAssetsPathProvider} from '@taiga-ui/core';
import { NG_EVENT_PLUGINS } from '@taiga-ui/event-plugins';
import { TuiConfirmService, tuiToastOptionsProvider } from '@taiga-ui/kit';
import { TUI_LANGUAGE, TUI_SPANISH_LANGUAGE, TUI_ENGLISH_LANGUAGE } from '@taiga-ui/i18n';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { errorInterceptor } from './core/http/error.interceptor';
import { loadingInterceptor } from './core/http/loading.interceptor';
import { getKeycloakProvider } from './core/auth/keycloak.config';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { TranslocoHttpLoader } from './core/i18n/transloco-loader';

import { ThemeService } from './core/branding/theme.service';
import {InitService} from './core/auth/init.service';

function initializeApp(theme: ThemeService) {
  return async () => {
    theme.init();
  };
}

function provideTuiLanguage(transloco: TranslocoService) {
  const activeLang = transloco.getActiveLang();
  return toSignal(
    transloco.langChanges$.pipe(
      map(lang => lang === 'en' ? TUI_ENGLISH_LANGUAGE : TUI_SPANISH_LANGUAGE)
    ),
    { initialValue: activeLang === 'en' ? TUI_ENGLISH_LANGUAGE : TUI_SPANISH_LANGUAGE }
  );
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withFetch(),
      withInterceptors([authInterceptor, errorInterceptor, loadingInterceptor])
    ),
    tuiAssetsPathProvider('https://taiga-ui.dev/assets/taiga-ui/icons'),
    provideAnimationsAsync(),
    NG_EVENT_PLUGINS,
    provideTaiga({
      fontScaling: true,
      scrollbars: 'native',
    }),
    tuiToastOptionsProvider({
      block: 'start',
      inline: 'end',
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
    {
      provide: TUI_LANGUAGE,
      useFactory: provideTuiLanguage,
      deps: [TranslocoService]
    },
    TuiConfirmService
  ]
};
