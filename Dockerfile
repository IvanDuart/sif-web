FROM node:22.22-trixie AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

FROM nginx:alpine

# Install envsubst for runtime configuration
RUN apk add --no-cache gettext

COPY --from=builder /app/dist/dagr-frontend/browser /usr/share/nginx/html

# Copy nginx configuration for SPA routing
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Copy the entrypoint script
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
