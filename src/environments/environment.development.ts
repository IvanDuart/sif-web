export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8081/api',
  keycloak: {
    //url: 'https://pre-login.carajillolabs.com',
    url: 'http://192.168.1.5:8088',
    realm: 'master',
    clientId: 'localhost-frontend',
  },
};
