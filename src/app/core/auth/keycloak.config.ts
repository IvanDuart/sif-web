import { provideKeycloak } from 'keycloak-angular';
import { environment } from '../../../environments/environment';

export function getKeycloakProvider() {
  return provideKeycloak({
    config: {
      url: environment.keycloak.url,
      realm: environment.keycloak.realm,
      clientId: environment.keycloak.clientId,
    },
    initOptions: {
      onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          globalThis.location.origin + '/assets/silent-check-sso.html',
    },
  });
}
