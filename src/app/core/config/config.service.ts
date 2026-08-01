import { Injectable } from '@angular/core';

interface Environment {
  API_URL?: string;
  KEYCLOAK_URL?: string;
  KEYCLOAK_REALM?: string;
  KEYCLOAK_CLIENT_ID?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private get env(): Environment {
    return (globalThis as unknown as Record<string, Environment>)['ENV'] || {};
  }

  get apiUrl(): string {
    const url = this.env.API_URL;
    return this.resolveValue(url, '___API_URL___', 'http://localhost:8081/api');
  }

  get keycloak() {
    return {
      url: this.resolveValue(this.env.KEYCLOAK_URL, '___KEYCLOAK_URL___', 'https://pre-login.carajillolabs.com'),
      realm: this.resolveValue(this.env.KEYCLOAK_REALM, '___KEYCLOAK_REALM___', 'master'),
      clientId: this.resolveValue(this.env.KEYCLOAK_CLIENT_ID, '___KEYCLOAK_CLIENT_ID___', 'localhost-frontend'),
    };
  }

  /**
   * Returns the value as-is when it has been properly substituted.
   * If the value is still a placeholder (e.g. "___API_URL___") or empty,
   * it means we are running in local dev without Docker, so we fall back
   * to the provided default.
   */
  private resolveValue(value: string | undefined, placeholder: string, fallback: string): string {
    if (!value || value === placeholder || /^\$\{.+\}$/.test(value)) {
      return fallback;
    }
    return value;
  }
}
