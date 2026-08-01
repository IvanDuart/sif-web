#!/bin/sh

export API_URL=${API_URL:-/api}
export KEYCLOAK_URL=${KEYCLOAK_URL:-http://localhost:8088}
export KEYCLOAK_REALM=${KEYCLOAK_REALM:-master}
export KEYCLOAK_CLIENT_ID=${KEYCLOAK_CLIENT_ID:-localhost-frontend}

sed -i "s|___API_URL___|${API_URL:-/api}|g" /usr/share/nginx/html/index.html
sed -i "s|___KEYCLOAK_URL___|${KEYCLOAK_URL:-http://localhost:8088}|g" /usr/share/nginx/html/index.html
sed -i "s|___KEYCLOAK_REALM___|${KEYCLOAK_REALM:-master}|g" /usr/share/nginx/html/index.html
sed -i "s|___KEYCLOAK_CLIENT_ID___|${KEYCLOAK_CLIENT_ID:-localhost-frontend}|g" /usr/share/nginx/html/index.html

exec nginx -g 'daemon off;'
