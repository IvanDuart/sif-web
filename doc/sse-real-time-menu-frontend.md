# Actualización del menú en tiempo real (SSE) — Guía para el frontend

## 1. Resumen

Añadimos un canal **Server-Sent Events (SSE)** para que la pantalla que visualiza una dieta
se actualice **automáticamente** cuando un nutricionista edita ese menú (nombre, comidas o
alimentos), **sin recargar la página**.

Caso de uso típico: el nutricionista tiene dos pantallas, en una ve la dieta y en la otra la
edita. La pantalla de solo lectura se refresca sola en cuanto guarda un cambio.

> SSE es una conexión HTTP de larga duración **unidireccional** (servidor → cliente). No
> necesita WebSockets ni un broker STOMP: el navegador recibe eventos por un stream de texto.

> **Hay un segundo canal SSE en el proyecto**, el de notificaciones del usuario
> (`GET /notifications/stream`), documentado en `doc/sse-notificaciones-frontend.md`. Comparte
> infraestructura y modo de autenticación con este, pero su evento trae el texto ya listo para
> mostrar en vez de una señal para recargar.

El backend **no envía la dieta completa** en el evento, sólo una **señal** con el `menuId` y
el **motivo**. Al recibirla, el frontend vuelve a pedir el menú por REST y repinta. Así el
contrato es simple y no depende de las vistas JSON de las entidades.

---

## 2. Endpoint SSE

```http
GET /api/tenant/{tenantId}/menu/{menuId}/stream
Authorization: Bearer <JWT>
Accept: text/event-stream
```

| Parámetro  | Tipo   | Descripción                                   |
|------------|--------|-----------------------------------------------|
| `tenantId` | UUID   | Tenant del menú (viene en la URL)             |
| `menuId`   | UUID   | Menú al que se suscribe la pantalla           |

**Permisos:** la suscripción se autoriza si el usuario tiene permiso `VIEW_MENU` en el tenant
(staff/nutricionista) **o** si es el **dueño** del menú (`isMenuOwner`, el propio paciente).

**Respuesta:** `200 OK` con `Content-Type: text/event-stream` y la conexión **abierta**.
Cabeceras relevantes: `Cache-Control: no-cache` y `X-Accel-Buffering: no` (para que proxies
como nginx no tamponicen el stream).

**Errores posibles:**

| HTTP | Significado |
|------|-------------|
| `401` | Falta el JWT o es inválido |
| `403` | Sin `VIEW_MENU` y sin ser dueño del menú |
| `404` | (No aplica a este endpoint) el menú no existe se valida al pedir los datos por REST |

> ⚠️ **Aviso sobre el `EventSource` nativo:** el `EventSource` de JavaScript **no permite
> enviar cabeceras HTTP**, por lo que no puede mandar el `Authorization: Bearer`. Como toda la
> API está protegida por JWT, en Angular hay que usar `@microsoft/fetch-event-source` (ver
> sección 5), que usa `fetch` por debajo y **sí** admite cabeceras.

---

## 3. Formato de los eventos

El stream emite eventos SSE con `event:` y `data:` estándar:

```
event: connected
data: {"tenantId":null,"menuId":"...","reason":"CONNECTED","occurredAt":"..."}

: keep-alive

event: menu-update
data: {"tenantId":"...","menuId":"...","reason":"MEAL_UPDATED","occurredAt":"2026-10-07T19:12:04.512Z"}
```

### 3.1 Evento `connected`

Se envía **una vez al abrir** la conexión. Sirve para confirmar que la suscripción se ha
establecido correctamente (por ejemplo, para mostrar un indicador de "en directo").

### 3.2 Evento `menu-update`

Se envía **cada vez que el menú cambia**. Carga útil:

```json
{
  "tenantId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "menuId": "1a2b3c4d-0000-0000-0000-000000000000",
  "reason": "MEAL_UPDATED",
  "occurredAt": "2026-10-07T19:12:04.512Z"
}
```

| Campo        | Tipo   | Descripción |
|--------------|--------|-------------|
| `tenantId`   | UUID   | Tenant del menú |
| `menuId`     | UUID   | Menú modificado (coincide con el `{menuId}` de la URL) |
| `reason`     | string | Qué ha cambiado (ver tabla) |
| `occurredAt` | string | Instante del cambio (ISO-8601 UTC) |

**Valores de `reason`:**

| `reason`        | Cuándo se emite |
|-----------------|-----------------|
| `CONNECTED`     | Evento inicial de la propia conexión (ignorar para recargar) |
| `MENU_UPDATED`  | Cambio de nombre, descripción o activación del menú |
| `MENU_DELETED`  | El menú se ha eliminado |
| `MEAL_CREATED`  | Nueva comida añadida al menú |
| `MEAL_UPDATED`  | Comida modificada (texto, alimentos, gramajes, día, tipo) |
| `MEAL_DELETED`  | Comida eliminada del menú |
| `DAY_COPIED`    | Se ha clonado un día completo del menú |

### 3.3 Comentarios de latido (`keep-alive`)

Cada ~20 segundos el servidor envía un **comentario SSE** (línea que empieza por `:`). No es
un evento: la librería lo ignora. Está para mantener viva la conexión a través de proxies.
Si tu implementación los recibe, simplemente ignóralos.

---

## 4. Qué hacer al recibir un `menu-update`

Recomendado: **refetch** (volver a pedir el menú por REST) y repintar. El evento ya se ha
emitido **después del commit** en base de datos, así que los datos que devuelva el GET son
los definitivos.

Endpoints útiles para el refetch (los actuales, sin cambios):

| Endpoint | Devuelve |
|----------|----------|
| `GET /api/tenant/{tenantId}/menu/{menuId}` | Menú completo (vista `Full`, incluye comidas y alimentos) |
| `GET /api/tenant/{tenantId}/meal/menu/{menuId}` | Lista de comidas del menú con sus alimentos (vista `Full`) |

Casos a contemplar:

- **`MENU_DELETED`**: no reintentes cargar el menú; gestiona el estado vacío / navega fuera.
- **Cambio de menú activo**: este canal es por `menuId`. Si tu pantalla muestra siempre "el
  menú activo del paciente" y el nutricionista activa *otro* menú, vuelve a cargar la lista
  de menús (`GET /api/tenant/{tenantId}/menu/user/{userId}`) o suscríbete al nuevo `menuId`.

---

## 5. Implementación en Angular (recomendada)

### 5.1 Instalación

```bash
npm install @microsoft/fetch-event-source
```

### 5.2 Servicio SSE reutilizable

```typescript
// menu-stream.service.ts
import { Injectable } from '@angular/core';
import { fetchEventSource, EventSourceMessage } from '@microsoft/fetch-event-source';
import { Observable } from 'rxjs';

export interface MenuUpdateEvent {
  tenantId: string | null;
  menuId: string;
  reason: 'CONNECTED' | 'MENU_UPDATED' | 'MENU_DELETED' | 'MEAL_CREATED'
        | 'MEAL_UPDATED' | 'MEAL_DELETED' | 'DAY_COPIED';
  occurredAt: string;
}

@Injectable({ providedIn: 'root' })
export class MenuStreamService {

  private abortController: AbortController | null = null;

  /**
   * Abre el canal SSE del menú. Emite un valor por cada evento `menu-update`.
   * Completa cuando se cierra la conexión (ngOnDestroy).
   */
  streamMenu(baseUrl: string, token: string, menuId: string, tenantId: string): Observable<MenuUpdateEvent> {
    return new Observable<MenuUpdateEvent>((subscriber) => {
      this.abortController = new AbortController();

      fetchEventSource(`${baseUrl}/tenant/${tenantId}/menu/${menuId}/stream`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
        },
        signal: this.abortController.signal,
        // Evita que la librería pause el stream cuando la pestaña pasa a segundo plano.
        openWhenHidden: true,

        async onopen(response) {
          if (response.ok && response.headers.get('content-type')?.includes('text/event-stream')) {
            return; // conexión correcta
          }
          throw new Error(`SSE no disponible: ${response.status}`);
        },

        onmessage(msg: EventSourceMessage) {
          if (msg.event !== 'menu-update') {
            return; // ignora 'connected' y comentarios keep-alive
          }
          try {
            subscriber.next(JSON.parse(msg.data) as MenuUpdateEvent);
          } catch (e) {
            console.error('Payload SSE inválido', msg.data, e);
          }
        },

        onclose() {
          // El servidor cerró (p. ej. timeout de 30 min). Lanzamos para que la librería reconecte.
          throw new Error('SSE cerrado por el servidor, reconectando...');
        },

        onerror(err) {
          // Devolver un número = esperar esos ms antes de reintentar.
          // Lanzar = detener. Aquí reintentamos siempre (pantalla desatendida).
          console.warn('Error SSE, reintentando', err);
          return 3000;
        },
      });
    });
  }

  close(): void {
    this.abortController?.abort();
    this.abortController = null;
  }
}
```

> **Nota sobre `onclose`/`onerror`:** `@microsoft/fetch-event-source` reintenta
> automáticamente si `onerror` devuelve un número. Al devolver `3000` reintenta a los 3 s
> indefinidamente, que es lo deseable para una pantalla que debe estar siempre viva.

### 5.3 Uso en el componente que muestra la dieta

```typescript
// patient-diet.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MenuStreamService, MenuUpdateEvent } from './menu-stream.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-patient-diet',
  templateUrl: './patient-diet.component.html',
})
export class PatientDietComponent implements OnInit, OnDestroy {

  menuId!: string;
  tenantId!: string;

  private streamSub?: Subscription;

  constructor(private menuStream: MenuStreamService, /* api, auth... */) {}

  ngOnInit(): void {
    // `menuId` y `tenantId` vendrán de la ruta / del contexto del usuario.
    this.loadMenu();
    this.connectStream();
  }

  ngOnDestroy(): void {
    // Obligatorio: cierra la conexión y libera el emisor en el backend.
    this.streamSub?.unsubscribe();
    this.menuStream.close();
  }

  private connectStream(): void {
    const token = /* tu token JWT actual */ this.getToken();

    this.streamSub = this.menuStream
      .streamMenu(environment.apiUrl, token, this.menuId, this.tenantId)
      .subscribe((event: MenuUpdateEvent) => {
        if (event.reason === 'MENU_DELETED') {
          // gestiona el borrado (navega fuera / estado vacío)
          return;
        }
        // Cualquier otro motivo: recarga el menú y repinta.
        this.loadMenu();
      });
  }

  private loadMenu(): void {
    // Tu llamada REST actual a GET /tenant/{tenantId}/menu/{menuId}
  }

  private getToken(): string { /* devuelve el JWT */ return ''; }
}
```

### 5.4 Alternativa con `EventSource` nativo (no recomendada)

Sólo funcionaría si el endpoint pudiera autenticarse **sin cabeceras** (por ejemplo, token
en query string). Actualmente **no** es el caso: hay que enviar el `Authorization: Bearer`.
Por eso se recomienda la opción de `fetch-event-source`.

---

## 6. Cuándo se emiten los eventos (backend)

Todos estos endpoints actuales disparan un `menu-update` al menú afectado (tras el commit):

| Endpoint que muta | `reason` emitido |
|---|---|
| `PATCH /api/tenant/{tenantId}/menu/{menuId}` | `MENU_UPDATED` |
| `DELETE /api/tenant/{tenantId}/menu/{menuId}` | `MENU_DELETED` |
| `POST /api/tenant/{tenantId}/menu/{menuId}/copy-day` | `DAY_COPIED` |
| `POST /api/tenant/{tenantId}/meal` | `MEAL_CREATED` |
| `PUT /api/tenant/{tenantId}/meal/{mealId}` | `MEAL_UPDATED` |
| `DELETE /api/tenant/{tenantId}/meal/{mealId}` | `MEAL_DELETED` |

---

## 7. Consideraciones de infraestructura

- **Duración de la conexión:** el servidor la cierra a los **30 minutos** como máximo. El
  cliente debe **reconectar** (la librería lo hace sola si `onerror` devuelve un número).
- **Latido:** el servidor envía comentarios cada **20 s** para que proxies y balanceadores no
  cierren la conexión por inactividad.
- **Timeout de sesión en MVC:** al ser una respuesta asíncrona, el backend ya permite el
  `DispatcherType.ASYNC` en seguridad. No requiere cambios de configuración en el frontend.
- **Proxy inverso (nginx):** el backend ya marca `X-Accel-Buffering: no`, que evita el
  buffering del stream. Si aun así no llegan eventos, revisar `proxy_buffering off;` y el
  `read_timeout` del proxy.
- **Múltiples instancias del backend:** el registro de suscriptores es **en memoria por
  nodo**. Si se escala horizontalmente, habría que añadir un bus distribuido (Redis pub/sub,
  Kafka…). Para el despliegue actual de una instancia no es necesario.
- **Adaptadores WSGI/ASGI intermedios:** si algún día se añade uno, usar un worker capaz de
  mantener conexiones largas.

---

## 8. Probar el endpoint manualmente

```bash
# La conexión queda abierta y va imprimiendo los eventos
curl -N \
  -H "Authorization: Bearer $JWT" \
  -H "Accept: text/event-stream" \
  "http://localhost:8081/api/tenant/$TENANT_ID/menu/$MENU_ID/stream"
```

Al guardar un cambio del menú desde otra terminal (o desde la UI del nutricionista) debería
aparecer un bloque `event: menu-update`.

---

## 9. Checklist de integración

- [ ] Instalar `@microsoft/fetch-event-source`.
- [ ] Crear un servicio que abra el stream con el JWT en cabecera.
- [ ] Suscribirse en la pantalla que muestra la dieta (paciente o nutricionista en modo lectura).
- [ ] En cada `menu-update` (excepto `CONNECTED`), hacer refetch del menú y repintar.
- [ ] Cerrar la conexión en `ngOnDestroy`.
- [ ] Gestionar `MENU_DELETED` con un estado vacío / navegación.
- [ ] Verificar reconexión automática tras 30 min de conexión.

---

## 10. Archivos backend implicados

| Ruta | Cambio |
|---|---|
| `controller/MenuStreamController.java` | **Nuevo.** Endpoint `GET .../menu/{menuId}/stream` (SSE) |
| `service/MenuStreamService.java` | **Nuevo.** Registro de emisores SSE, broadcast y latido |
| `models/dto/MenuUpdateEvent.java` | **Nuevo.** Evento de dominio y payload SSE |
| `service/MenuService.java` | Publica `MENU_UPDATED`, `MENU_DELETED`, `DAY_COPIED` |
| `service/MealService.java` | Publica `MEAL_CREATED`, `MEAL_UPDATED`, `MEAL_DELETED` |
| `application.yaml` | `app.menu-stream.heartbeat-ms` (por defecto 20000) |
