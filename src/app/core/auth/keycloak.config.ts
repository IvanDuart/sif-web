import { provideKeycloak } from 'keycloak-angular';
import {ConfigService} from '../config/config.service';

export function getKeycloakProvider() {
  const configService = new ConfigService();
  const keycloakConfig = configService.keycloak;

  return provideKeycloak({
    config: {
      url: keycloakConfig.url,
      realm: keycloakConfig.realm,
      clientId: keycloakConfig.clientId,
    },
    initOptions: {
      onLoad: 'check-sso',
        silentCheckSsoRedirectUri:
          globalThis.location.origin + '/assets/silent-check-sso.html',
    },
  });
}
