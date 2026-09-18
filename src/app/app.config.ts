import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER, LOCALE_ID, computed, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import localeEn from '@angular/common/locales/en';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import {provideTaiga, tuiAssetsPathProvider, tuiValidationErrorsProvider} from '@taiga-ui/core';
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

registerLocaleData(localeEs, 'es');
registerLocaleData(localeEn, 'en');

function initializeApp(theme: ThemeService) {
  return async () => {
    theme.init();
  };
}

function provideTuiValidationErrors() {
  const transloco = inject(TranslocoService);
  const lang = toSignal(transloco.langChanges$, { initialValue: transloco.getActiveLang() });
  const msg = (key: string, params?: Record<string, unknown>) =>
    computed(() => { lang(); return transloco.translate(key, params); });

  return {
    required: msg('validation.required'),
    email: msg('validation.email'),
    min: ({ min }: { min: number }) => msg('validation.min', { min }),
    max: ({ max }: { max: number }) => msg('validation.max', { max }),
    minlength: ({ requiredLength }: { requiredLength: number }) => msg('validation.minlength', { length: requiredLength }),
    maxlength: ({ requiredLength }: { requiredLength: number }) => msg('validation.maxlength', { length: requiredLength }),
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
    tuiValidationErrorsProvider(provideTuiValidationErrors),
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
      provide: LOCALE_ID,
      useFactory: () => localStorage.getItem('preferredLanguage') ?? 'es'
    },
    {
      provide: TUI_LANGUAGE,
      useFactory: provideTuiLanguage,
      deps: [TranslocoService]
    },
    TuiConfirmService
  ]
};
