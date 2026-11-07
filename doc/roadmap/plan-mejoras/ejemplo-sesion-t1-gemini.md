> **Este es un ejemplo relleno de la plantilla `plantilla-sesion.md`.**  
> Puedes copiar la estructura y adaptarla a cualquier otra tarea del plan.

---

# Sesión: T1 — Enmascarar y cifrar `geminiApiKey`

## 1. Información de la sesión

| Campo | Valor |
|---|---|
| **ID de sesión / agente** | `AGENTE_SEGURIDAD_01` |
| **Fecha de inicio** | `2026-10-30` |
| **Fecha estimada de cierre** | `2026-11-03` |
| **Fase del plan** | `Fase 0 — Endurecer` |
| **Tarea(s) asignada(s)** | `T1` |
| **Duración estimada** | `2-3 días` |

---

## 2. Contexto obligatorio a leer antes de empezar

- [x] `doc/roadmap/plan-mejoras/README.md`
- [x] `doc/roadmap/plan-mejoras/fase-0-endurecer.md`
- [x] `doc/roadmap/plan-mejoras/orden-ejecucion.md`
- [x] Código existente relevante:
  - `src/main/java/com/carajillolabs/tusdietas/models/entity/TenantPreferences.java`
  - `src/main/java/com/carajillolabs/tusdietas/models/entity/Tenant.java`
  - `src/main/java/com/carajillolabs/tusdietas/controller/TenantProfileController.java`
  - `src/main/java/com/carajillolabs/tusdietas/controller/TenantBrandingController.java`
  - `src/main/java/com/carajillolabs/tusdietas/service/TenantService.java`
- [ ] `doc/contrato-api/breaking-changes.md` (por ahora no aplica, se actualizará si cambia el DTO)
- [ ] Otros documentos específicos: `doc/contrato-api/security/userType.md` (revisar si menciona preferencias públicas)

---

## 3. Objetivo de la sesión

> Implementar la protección de la clave API de Gemini: hacerla write-only en lecturas, cifrarla en base de datos, exponer `hasApiKey` donde sea necesario y garantizar que ningún endpoint GET la filtre.

---

## 4. Decisiones de producto ya tomadas

| Decisión | Implicación técnica |
|---|---|
| API key Gemini siempre del centro | No hay modo "cuota incluida"; solo se protege la clave del tenant. |
| Nutrientes HIDDEN por defecto | El DTO público de branding ya no necesita saber la clave, solo si existe (`hasApiKey`). |

---

## 5. Alcance de esta sesión

### Dentro del alcance

- [ ] Añadir `@JsonIgnore` a `geminiApiKey` en `TenantPreferences` o crear DTO de lectura separado.
- [ ] Añadir `hasApiKey` a los DTOs que necesiten saber si la clave está configurada.
- [ ] Cifrar/descifrar la clave al persistir/leer `Tenant.preferences`.
- [ ] Migración Flyway para cifrar claves existentes en producción.
- [ ] Test de contrato que verifique ausencia de `geminiApiKey` en `GET /tenant/{id}/profile` y `GET /tenant/{id}/branding`.

### Fuera del alcance (no tocar)

- [ ] No cambiar el modelo de negocio de IA (sigue siendo clave del centro).
- [ ] No implementar rotación automática de claves (puede añadirse más adelante).
- [ ] No modificar lógica de uso de la clave en `GeminiService`; solo proteger su almacenamiento y serialización.

---

## 6. Archivos y tablas esperados

### Entidades / DTOs / controladores a crear o modificar

| Tipo | Archivo | Acción |
|---|---|---|
| Entity | `models/entity/TenantPreferences.java` | Modificar: `@JsonIgnore` en `geminiApiKey`. |
| Entity | `models/entity/Tenant.java` | Modificar: usar DTO de lectura o cifrar JSONB. |
| DTO | `models/dto/TenantBrandingDto.java` | Modificar: añadir `hasApiKey`. |
| Service | `service/TenantService.java` | Modificar: cifrado/descifrado en `updatePreferences` y `getById`. |
| Config | Nuevo `config/EncryptionConfig.java` | Crear: bean de cifrado AES/GCM. |
| Test | `src/test/.../TenantProfileSecurityTest.java` | Crear: test de contrato. |

### Migraciones Flyway

| Archivo | Descripción |
|---|---|
| `V48__encrypt_gemini_api_keys.sql` | Script idempotente para migrar claves planas a cifradas (o marcarlas como migradas). |

> **Nota:** si el cifrado se hace en Java, la migración puede consistir en una columna auxiliar y un job de arranque; documentar la estrategia elegida.

### Endpoints afectados

| Método | Ruta | Cambio |
|---|---|---|
| GET | `/tenant/{tenantId}/profile` | Asegurar que no devuelve `geminiApiKey`. |
| GET | `/tenant/{tenantId}/branding` | Asegurar que no devuelve `geminiApiKey`; puede devolver `hasApiKey`. |
| PUT | `/tenant/{tenantId}/profile/preferences` | Seguir permitiendo escribir la clave. |
| PUT | `/tenant/{tenantId}/branding/preferences` | Seguir permitiendo escribir la clave. |

---

## 7. Pasos sugeridos de implementación

1. **Elegir estrategia de cifrado:**
   - Opción A: cifrar solo el campo `geminiApiKey` dentro del JSONB usando AES/GCM con clave maestra en `application.yaml`.
   - Opción B: migrar la clave a una tabla separada `tenant_secret` y referenciarla desde preferencias.
   - *Recomendación:* Opción A para esta fase; Opción B puede ser deuda técnica futura.

2. **Crear utilidad de cifrado:**
   - `utils/EncryptionService.java` con métodos `encrypt(String)` y `decrypt(String)`.
   - Usar clave maestra desde `application.yaml` (`app.encryption.master-key`).

3. **Modificar `TenantService`:**
   - En `updatePreferences`: si viene `geminiApiKey`, cifrar antes de guardar.
   - En `getById`: descifrar al leer para uso interno (por ejemplo, `GeminiService`).
   - Nunca devolver la clave descifrada en DTOs de lectura.

4. **Modificar DTOs de lectura:**
   - `TenantBrandingDto`: añadir `hasApiKey` calculado como `preferences.geminiApiKey != null && !isBlank`.
   - `Tenant` en `JsonViews.Public`: asegurar que `preferences.geminiApiKey` no se serializa.

5. **Crear migración:**
   - Si el cifrado es en Java, la migración SQL puede ser un `UPDATE` que marque claves existentes como `"__MIGRATE__"` y un componente de arranque las cifre.
   - Alternativa: script one-off fuera de Flyway ejecutado manualmente.

6. **Tests:**
   - Test de integración que llame `GET /tenant/{id}/profile` y verifique que `geminiApiKey` no aparece.
   - Test que verifique que `PUT /tenant/{id}/branding/preferences` con `geminiApiKey` la guarda y `GET` posterior no la devuelve.

---

## 8. Definition of Done (DoD)

- [x] Código implementado siguiendo estilo del proyecto.
- [x] Migración Flyway creada y probada.
- [x] Tests unitarios y de integración añadidos.
- [x] OpenAPI actualizado si cambia algún DTO público.
- [x] Aplicación compila con `./mvnw clean verify`.
- [x] `doc/contrato-api/breaking-changes.md` actualizado si el DTO de branding cambia.
- [x] Revisión de seguridad: no se expone la clave en logs ni respuestas.

---

## 9. Riesgos y bloqueantes

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Claves existentes en producción no se migran correctamente | Media | Hacer backup antes; probar migración en staging con datos reales. |
| `GeminiService` deja de funcionar tras cifrar | Media | Asegurar que el servicio lee la clave descifrada internamente. |
| KMS no disponible aún | Baja | Usar clave maestra en properties como solución transitoria. |

---

## 10. Registro de progreso

| Fecha | Avance | Bloqueantes | Notas |
|---|---|---|---|
| 2026-10-30 | Inicio sesión, lectura de contexto | Ninguno | Se elige estrategia A (cifrado de campo en JSONB). |
| 2026-10-31 | Implementación de `EncryptionService` y modificación de `TenantService` | Ninguno | Pendiente migración. |
| 2026-11-02 | Migración y tests añadidos | Ninguno | Todos los tests pasan. |
| 2026-11-03 | Cierre y documentación | Ninguno | DoD completo. |

---

## 11. Conclusiones y handover

- Se entregó la protección completa de `geminiApiKey`.
- La clave se cifra con AES/GCM y una clave maestra en `application.yaml`.
- Los endpoints GET no exponen la clave; se devuelve `hasApiKey` en branding.
- **Deuda técnica:** evaluar migración a KMS o tabla `tenant_secret` en el futuro.
- **Siguiente tarea recomendada:** `T5 — PATCH /tenant/{id}/preferences` con merge, ya que toca el mismo dominio de preferencias.
