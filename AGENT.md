:rotating_light: **Lee este archivo al inicio de cada sesión.** Define dónde vive cada tipo de documentación y cómo mantenerla.

# AGENT.md — Normas de documentación para sif-web

## 1. Propósito

Este archivo es el punto de entrada para cualquier agente que trabaje en el repositorio. Describe la estructura de `doc/`, las reglas para clasificar documentos nuevos y las obligaciones de mantenimiento cuando se añade, mueve o modifica documentación técnica.

## 2. Estructura de `doc/`

```text
doc/
├── README.md                 # Índice maestro (empezar aquí)
├── AGENT.md                  # Este archivo
├── contrato-api/             # Backend: contratos, endpoints, reglas de negocio
├── frontend/                 # Frontend Angular: integración, UX, arquitectura
├── roadmap/                  # Planes de futuro y sesiones por fases
└── assets/                   # Imágenes y recursos compartidos
```

- **`doc/contrato-api/`** — Todo lo relativo al backend: endpoints REST/SSE, DTOs, permisos, migraciones, reglas de negocio, peticiones de cambio al backend y bugs de API.
- **`doc/frontend/`** — Todo lo relativo al desarrollo de la aplicación web Angular: guías de integración, decisiones de UX, ejemplos de código, planes de mejora de funcionalidades web.
- **`doc/roadmap/`** — Planes de futuro, orden de ejecución y plantillas de sesión. No debe usarse como fuente de verdad del sistema actual.

## 3. Reglas de clasificación

| Si el documento habla de… | Va en |
|---|---|
| Endpoints, métodos HTTP, códigos de respuesta, DTOs | `doc/contrato-api/<dominio>/` |
| Permisos, roles, autenticación, ciclo de vida de cuentas | `doc/contrato-api/security/` |
| Migraciones de base de datos, reglas de negocio del backend | `doc/contrato-api/<dominio>/` |
| Peticiones de cambio o correcciones al backend | `doc/contrato-api/<dominio>/` |
| Cómo integrar una funcionalidad en Angular | `doc/frontend/<dominio>/` |
| Decisiones de UX, flujos de pantalla, prototipos | `doc/frontend/<dominio>/` |
| Ejemplos de código TypeScript/HTML para el frontend | `doc/frontend/<dominio>/` |
| Planes de mejora o refactor pendientes del frontend | `doc/frontend/<dominio>/` |
| Cambios incompatibles entre versiones del API | `doc/contrato-api/breaking-changes.md` |
| Especificación OpenAPI/Swagger | `doc/contrato-api/api-docs.json` |
| Roadmap y sesiones de trabajo futuras | `doc/roadmap/` |

> **No mezcles contratos backend con guías frontend.** Si un mismo feature necesita ambas cosas, crea dos documentos separados y enlázalos.

## 4. Dominios disponibles

Dentro de `contrato-api/` y `frontend/` existen las siguientes carpetas de dominio:

- `appointments/` — citas, agenda, calendario, precios, métricas.
- `architecture/` — solo en `contrato-api/`: tenants, MinIO, versionado, historia.
- `body-composition/` — composición corporal e informes.
- `menus/` — menús, plantillas, BEDCA, subida con IA.
- `notifications/` — push y SSE.
- `patients/` — pacientes, perfil clínico, anamnesis.
- `security/` — solo en `contrato-api/`: usuarios, roles, permisos.
- `ai/` — Gemini y lista de la compra.
- `assistant/` — NutrIA (asistente para nutricionistas).
- `chat/` — chat 1:1.
- `mascot/` — mascota conversacional.
- `billing/` — facturación y suscripciones.

Si un feature no encaja en ninguno, propón un nuevo dominio en el `README.md` raíz antes de crearlo.

## 5. Cómo mantener los índices

Cada carpeta de dominio debe tener un `README.md` con la lista de documentos y una breve descripción. Los índices principales son:

- `doc/README.md` — índice maestro.
- `doc/contrato-api/README.md` — índice del backend.
- `doc/frontend/README.md` — índice del frontend.
- `doc/<area>/<dominio>/README.md` — índice de cada dominio.

**Al añadir un documento:**
1. Colócalo en la carpeta correcta según las reglas de clasificación.
2. Añádelo al `README.md` de su dominio.
3. Si es transversal o de primer nivel, añádelo a `doc/README.md` y/o al `README.md` de `contrato-api/` o `frontend/`.

**Al mover un documento:**
1. Usa `git mv` para preservar el historial.
2. Actualiza todas las referencias internas (`[texto](ruta)` y menciones de texto `doc/...`).
3. Actualiza los `README.md` afectados.

**Al eliminar un documento:**
1. Elimínalo con `git rm`.
2. Quita la entrada de los `README.md` donde aparezca.
3. Si el documento tenía dependientes, actualiza o elimina las referencias.

## 6. Convenciones de enlaces

- **Enlaces internos:** usa rutas relativas al archivo que los contiene.
- **Referencias de texto:** cuando menciones otro documento en texto plano (por ejemplo, "ver `doc/contrato-api/appointments/appointments.md`"), usa la ruta completa desde `doc/`.
- **Referencias en código:** en comentarios TypeScript también usa la ruta completa desde `doc/`.
- **No uses rutas absolutas del sistema de archivos.**

Ejemplo de referencia en código:

```ts
// Ver doc/contrato-api/appointments/appointments.md §3 para los estados de cita.
```

## 7. Documentos transversales obligatorios

- **`doc/contrato-api/breaking-changes.md`** — cualquier cambio incompatible en DTOs, respuestas, endpoints o permisos debe documentarse aquí.
- **`doc/contrato-api/api-docs.json`** — especificación OpenAPI/Swagger del backend.
- **`AGENT.md`** — este archivo.

## 8. Checklist antes de terminar una tarea

- [ ] ¿He creado o actualizado la documentación del contrato si cambié la API?
- [ ] ¿He creado o actualizado la guía de integración frontend si cambié la UI?
- [ ] ¿He actualizado los `README.md` afectados?
- [ ] ¿He actualizado `breaking-changes.md` si hay cambios incompatibles?
- [ ] ¿He comprobado que no quedan enlaces rotos con `grep -R "doc/"`?
- [ ] ¿He ejecutado `git status` para verificar que solo se movió lo necesario?

## 9. Notas importantes

- `CLAUDE.md` sigue siendo la guía de proyecto para Claude Code. Consulta `AGENT.md` cuando necesites saber **dónde** documentar algo.
- `doc/API.md` es una referencia histórica que ya no existe; si la encuentras en documentos antiguos, apunta a `doc/contrato-api/README.md` o al documento de dominio más específico.
- Los planes de `doc/roadmap/` pueden quedar desactualizados; contrasta siempre con el código antes de implementar.
