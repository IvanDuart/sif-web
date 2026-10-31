# Roadmap y planes de futuro

Esta carpeta contiene **planes de implementación**, no documentación del sistema actual. Sirven para que distintos agentes o sesiones ejecuten fases de trabajo de forma independiente.

## Planes

| Plan | Contenido |
|---|---|
| [`plan-mejoras/`](plan-mejoras/README.md) | Roadmap backend por fases: endurecimiento, suscripciones con Stripe, planificación, conexión y automatización. |
| [`plan-chat-mascota/`](plan-chat-mascota/README.md) | Dos planes independientes: chat 1:1 paciente–nutricionista y mascota/asistente conversacional. |

## Cuándo usar esta carpeta

- Para entender **qué se va a construir** y en qué orden.
- Para ejecutar una fase concreta sin depender del resto.
- Para revisar decisiones de producto cerradas (precios, IA, almacenamiento, etc.).

## Cuándo **no** usarla

- Para entender el comportamiento actual del backend. La fuente de verdad es el código Java y la documentación de los dominios (`appointments/`, `patients/`, `menus/`, etc.).

## Notas

- Los planes pueden quedar desactualizados respecto al código. Antes de implementar, contrasta con el repositorio.
- Las migraciones Flyway y los números de versión que aparecen en los planes deben revisarse antes de usarlos.
