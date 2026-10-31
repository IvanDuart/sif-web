# Composición corporal

Documentación del motor clínico de composición corporal, las mediciones, los cambios de contrato para clientes y el informe en PDF.

## Documentos

| Documento | Contenido |
|---|---|
| [`body_composition_and_segmental_measurements.md`](body_composition_and_segmental_measurements.md) | Documento principal: modelo de datos, endpoints, reporte clínico, complexión de Grant, masa ósea, análisis segmental, simetría y rangos de referencia. |
| [`cambios-composicion-corporal-frontend.md`](cambios-composicion-corporal-frontend.md) | Guía de cambios v1 para frontend: `muscleMassKg` → `muscleMassPct`, `visceralFatLevel`, clasificación del % de grasa. |
| [`cambios-composicion-corporal-v2-frontend.md`](cambios-composicion-corporal-v2-frontend.md) | Guía de cambios v2: procedencia de datos (`MEASURED`, `CARRIED_FORWARD`, `ESTIMATED`), `symmetry` anulable, `segmentalAnalysis` incompleto y nuevo tramo `OVERWEIGHT`. |
| [`pdf-composicion-corporal.md`](pdf-composicion-corporal.md) | Endpoint de descarga del informe en PDF y contenido del documento. |
| [`measurements_and_gender.md`](measurements_and_gender.md) | Nuevas mediciones (cintura, pecho, cadera, contorno, brazo, agua) y campo `gender`. |

## Orden de lectura sugerido

1. **Para entender el modelo completo:** `body_composition_and_segmental_measurements.md`.
2. **Para integrar el frontend con la versión vigente:** `cambios-composicion-corporal-v2-frontend.md`.
3. **Para entender la evolución del contrato:** `cambios-composicion-corporal-frontend.md` (v1).
4. **Para el PDF:** `pdf-composicion-corporal.md`.
5. **Para los campos de medición y género:** `measurements_and_gender.md`.

## Relaciones con otros dominios

- **Pacientes:** el perfil clínico y los datos del paciente se documentan en [`../patients/patient_profile.md`](../patients/patient_profile.md).
- **Histórico del modelo:** [`../architecture/history.md`](../architecture/history.md) describe la evolución inicial de `body_measurement` y las migraciones V4, V39 y V40.
- **Menús:** el PDF de composición corporal comparte patrón de generación con el PDF de menú. Ver [`../menus/menu-pdf-and-tenant-contact.md`](../menus/menu-pdf-and-tenant-contact.md).

## Notas

- `cambios-composicion-corporal-frontend.md` describe la **v1**; la **v2** es la guía vigente para frontend. Se conserva la v1 como referencia histórica.
- El IMC y la edad son valores calculados, nunca persistidos.
- La grasa visceral ya no se estima: si la báscula no la reporta, llega `null`.
