# Planes independientes — Chat y Mascota

> **Ubicación:** `doc/roadmap/plan-chat-mascota/`
> **Propósito:** dos planes de implementación autónomos, sin dependencia de las fases de `doc/roadmap/plan-mejoras/`.
> **Estado:** backend v1 de Chat y Mascota implementado (migraciones `V54` y `V55`). El frontend Angular se implementa en su repositorio con los contratos `doc/contrato-api/chat/chat-frontend.md` y `doc/contrato-api/mascot/mascota-frontend.md`.
> **Última actualización:** 2026-10-30

---

## 1. Qué contiene esta carpeta

| Documento | Alcance | Estimación backend |
|---|---|---|
| [`plan-chat.md`](plan-chat.md) | Chat 1:1 paciente–nutricionista con texto, imágenes en MinIO, SSE, push y no leídos. | 3–4 semanas |
| [`plan-mascota.md`](plan-mascota.md) | Asistente conversacional con mascota en Angular y motor en Java/Gemini que propone y confirma el rellenado de campos. | 8–10 semanas |

Los dos planes son **independientes entre sí**. Comparten infraestructura (MinIO, SSE, notificaciones, permisos), pero ninguno bloquea al otro. Se pueden ejecutar en paralelo si hay equipo suficiente.

---

## 2. Prerrequisito común: MinIO operativo

Ambos planes asumen que ya existe una integración de almacenamiento de objetos funcionando. El contrato mínimo que deben encontrar es:

```java
public interface StorageService {

    StoredFile upload(UUID tenantId,
                      String entityType,
                      UUID entityId,
                      String fileName,
                      byte[] bytes,
                      String contentType);

    void delete(UUID storedFileId);

    PresignedUrl presignedUrl(UUID storedFileId, Duration ttl);

    record PresignedUrl(String url, Instant expiresAt) {}
}
```

Y una tabla `stored_file` con, al menos:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK a `tenant` |
| `bucket` | VARCHAR | Bucket privado |
| `path` | VARCHAR | Ruta interna en MinIO |
| `content_type` | VARCHAR | MIME real validado |
| `size_bytes` | BIGINT | Tamaño |
| `entity_type` | VARCHAR | `CHAT_ATTACHMENT`, `MASCOT_AVATAR`, etc. |
| `entity_id` | UUID | Entidad propietaria |
| `created_at` | TIMESTAMPTZ | |

Reglas no negociables:

- Bucket **privado**. Nunca se sirve una URL pública directa.
- Toda descarga usa URL firmada con TTL.
- El backend valida MIME y tamaño antes de subir.
- El borrado lógico de la entidad no borra el objeto físico de inmediato; se hace por job o al purgar.

Si el contrato real difiere, se adapta el adaptador en cada plan; la lógica de negocio no cambia.

---

## 3. Prerrequisitos técnicos comunes

| Requisito | Estado actual | Notas |
|---|---|---|
| Spring Boot 4.1.1 / Java 25 | Ya existe | Mantener. |
| Keycloak JWT + `@hasAccess` | Ya existe | Reutilizar para autorización. |
| SSE (`SseEmitter`) | Ya existe en `MenuStreamService` y `NotificationStreamService` | Reutilizar el patrón, no inventar otro. |
| Push OneSignal | Ya existe en `PushNotificationService` | Reutilizar `notifyUserAfterCommit`. |
| Gemini en Java | `com.google.genai:google-genai:1.77.0` ya en `pom.xml` | Solo la mascota lo usa. |
| Redis | **Dependencia obligatoria desde v1** | `spring-boot-starter-data-redis`; bus de eventos del chat en `192.168.1.5:6379` (configurable por `REDIS_HOST`/`REDIS_PORT`). |
| Frontend | Angular, con `@microsoft/fetch-event-source` para SSE | Confirmado en `doc/frontend/notifications/sse-notificaciones-frontend.md`. |

---

## 4. Convenciones que deben respetar ambos planes

1. **Paquete base:** `com.carajillolabs.tusdietas`.
2. **Controladores:** `controller/`; DTOs de entrada en `controller/dto/`; DTOs de salida en `models/dto/` o `controller/dto/`.
3. **Entidades:** `models/entity/`; repositorios en `repository/`; servicios en `service/`.
4. **Migraciones:** Flyway en `src/main/resources/db/migration/`. La última actual es `V53`. El chat usa `V54` y la mascota `V55`. Renumerar si otra rama consume esos números.
5. **Autorización:** `@PreAuthorize("@hasAccess...")` en controlador y validación de pertenencia en servicio. Nunca confiar solo en el controlador.
6. **Aislamiento multi-tenant:** toda consulta filtra por `tenant_id`. No usar el `tenantId` de la ruta sin comprobar que el recurso pertenece a él.
7. **Errores:** añadir códigos a `exception/ErrorResource.java` y lanzar `NotFoundException`, `ForbiddenException` o `ConflictException`.
8. **OpenAPI:** `@Operation` y `@Tag` en cada endpoint.
9. **Tests:** unitarios de servicio + MVC de controlador. No hace falta Testcontainers para v1; sí mocks de `StorageService` y del cliente Gemini.
10. **Breaking changes:** documentar en `doc/contrato-api/breaking-changes.md` si cambia un DTO existente.

---

## 5. Decisiones transversales ya cerradas

- **Sin versionado `/api/v1`.** Se mantiene el context-path `/api`.
- **Sin pagos ni reserva pública.**
- **La IA es siempre del centro:** `TenantPreferences.aiEnabled` y `TenantPreferences.geminiApiKey`.
- **La clave Gemini debe estar cifrada y enmascarada** antes de exponer la mascota. Si aún no lo está, es un prerrequisito duro del plan de mascota.
- **Nada de datos clínicos sensibles en push.** El push solo anuncia que hay algo nuevo.
- **La mascota no da consejo clínico.** Captura datos y guía; no diagnostica ni prescribe.
- **Toda escritura de la mascota requiere confirmación explícita del usuario.**

---

## 6. Orden sugerido si se hacen ambos

Aunque son independientes, este orden reduce retrabajo:

1. Chat (3–4 semanas). Deja probados SSE, adjuntos en MinIO, permisos y push.
2. Mascota (8–10 semanas). Reutiliza SSE y MinIO, y añade el motor Gemini.

Si se paralelizan, congelar antes el contrato de `StorageService` y el formato de eventos SSE.
