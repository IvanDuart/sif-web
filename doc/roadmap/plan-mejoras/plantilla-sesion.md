# Plantilla de sesión por agente

> **Propósito:** documento reutilizable para iniciar una sesión o asignar un agente a una fase/tarea concreta del plan de mejoras.  
> **Instrucciones:** copiar este archivo, renombrarlo a `sesion-<fase>-<tarea>-<fecha>.md` y rellenar cada sección antes de empezar a implementar.

---

## 1. Información de la sesión

| Campo | Valor |
|---|---|
| **ID de sesión / agente** | `AGENTE_X` |
| **Fecha de inicio** | `YYYY-MM-DD` |
| **Fecha estimada de cierre** | `YYYY-MM-DD` |
| **Fase del plan** | `Fase 0 / 1 / 2 / 3` |
| **Tarea(s) asignada(s)** | `T1 / P3 / etc.` |
| **Duración estimada** | `X días` |

---

## 2. Contexto obligatorio a leer antes de empezar

Marcar cada elemento como leído:

- [ ] `doc/roadmap/plan-mejoras/README.md`
- [ ] `doc/roadmap/plan-mejoras/fase-X-<nombre>.md` (archivo de la fase asignada)
- [ ] `doc/roadmap/plan-mejoras/orden-ejecucion.md`
- [ ] Código existente relevante en `src/main/java/com/carajillolabs/tusdietas/`
- [ ] `doc/breaking-changes.md` (para entender cambios previos)
- [ ] Otros documentos específicos: `______________________________`

---

## 3. Objetivo de la sesión

Describir en una o dos frases qué se espera entregar al cerrar la sesión:

> Ejemplo: *Implementar el endpoint `PATCH /tenant/{id}/preferences` con merge por campo, validando que un patch parcial no borre flags no incluidos.*

______________________________________________________________________

---

## 4. Decisiones de producto ya tomadas

Listar aquí las decisiones del `README.md` que afectan directamente a esta tarea:

| Decisión | Implicación técnica |
|---|---|
| | |
| | |

---

## 5. Alcance de esta sesión

### Dentro del alcance

- [ ] _________________________________________________________________
- [ ] _________________________________________________________________
- [ ] _________________________________________________________________

### Fuera del alcance (no tocar)

- [ ] _________________________________________________________________
- [ ] _________________________________________________________________
- [ ] _________________________________________________________________

---

## 6. Archivos y tablas esperados

### Entidades / DTOs / controladores a crear o modificar

| Tipo | Archivo | Acción |
|---|---|---|
| | | Crear / Modificar / Eliminar |
| | | Crear / Modificar / Eliminar |
| | | Crear / Modificar / Eliminar |

### Migraciones Flyway

| Archivo | Descripción |
|---|---|
| `VNN__descripcion.sql` | |

### Endpoints afectados

| Método | Ruta | Cambio |
|---|---|---|
| | | Nuevo / Modificado / Eliminado |

---

## 7. Pasos sugeridos de implementación

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
4. _________________________________________________________________
5. _________________________________________________________________

---

## 8. Definition of Done (DoD)

Marcar al cerrar la sesión:

- [ ] Código implementado siguiendo estilo del proyecto (Lombok, records, `JsonViews`, `@PreAuthorize`).
- [ ] Migración Flyway creada y probada (incluyendo rollback si aplica).
- [ ] Tests unitarios y/o de integración añadidos para lógica nueva.
- [ ] OpenAPI actualizado (`@Operation`, `@ApiResponse`, `@SecurityScheme` si aplica).
- [ ] Aplicación compila: `./mvnw clean verify` o `mvn clean verify` sin errores.
- [ ] `doc/breaking-changes.md` actualizado si hay cambios en contrato.
- [ ] Documentación de la fase actualizada si ha cambiado el alcance.
- [ ] Revisión de seguridad básica: no se exponen secretos, permisos correctos.

---

## 9. Riesgos y bloqueantes

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| | | |
| | | |

---

## 10. Registro de progreso

| Fecha | Avance | Bloqueantes | Notas |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

---

## 11. Conclusiones y handover

Resumen de lo entregado, deudas técnicas pendientes y lo que debe saber el siguiente agente:

______________________________________________________________________

______________________________________________________________________
