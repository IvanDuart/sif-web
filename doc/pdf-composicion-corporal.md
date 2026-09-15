# PDF de composición corporal

## 1. Resumen

Se añade un endpoint para **descargar en PDF el informe clínico de composición corporal** de un paciente, con el mismo contenido que el dashboard de composición corporal del frontend: complexión física (índice de Grant), evaluación de masa ósea, 6 indicadores clave, rangos de referencia clínicos con semáforo de estado, análisis segmental por 5 zonas corporales y simetría lateral bilateral.

El PDF se genera **bajo demanda** a partir de la última medición del paciente (mismo cálculo que `GET /measurements/latest`, sin persistir nada) y sigue el mismo patrón de generación server-side con PDFBox que `MenuPdfService` (logo, nombre y color del tenant en la cabecera).

Para el detalle completo del modelo de datos de composición corporal (`BodyCompositionReport` y sub-objetos), ver [`body_composition_and_segmental_measurements.md`](./body_composition_and_segmental_measurements.md).

---

## 2. Nuevo endpoint

| Método | Ruta | Permiso | Response | Códigos |
|---|---|---|---|---|
| `GET` | `/tenant/{tenantId}/users/{userId}/measurements/pdf` | `VIEW_USER` (o el propio paciente) | `byte[]` (`application/pdf`) | 200, 404 |

El permiso usa el guard `withTenantPermissionOrSelf(#tenantId, 'VIEW_USER', #userId)`: puede descargarlo el personal del tenant con permiso `VIEW_USER`, **o el propio paciente** consultando su propio informe — igual que `GET /measurements/latest` y `GET /measurements/evolution`.

**Ejemplo:**

```bash
curl "http://localhost:8081/api/tenant/{tenantId}/users/{userId}/measurements/pdf" \
  -H "Authorization: Bearer $TOKEN" \
  -o composicion-corporal.pdf
```

El PDF se devuelve con `Content-Disposition: inline; filename="composicion-corporal-{userId}.pdf"` para que el navegador/webview lo muestre directamente en lugar de forzar la descarga.

---

## 3. Contenido del PDF

El PDF generado incluye, en este orden:

1. **Cabecera**: logo, nombre y color del tenant; nombre, sexo y edad del paciente; fecha de cálculo ("Calculado el: dd/MM/yyyy").
2. **Complexión Física (Índice de Grant)**: descripción localizada (p. ej. "Complexión Media (Índice r: 9.71)").
3. **Evaluación de Masa Ósea**: masa ósea en kg, % sobre el peso total, evaluación y descripción localizada.
4. **6 indicadores clave** (tiles): Masa Grasa, Masa Magra, Agua Corporal, IMC (con badge de clasificación), % Grasa Corporal (con badge de clasificación) y Grasa Visceral.
5. **Rangos de Referencia Clínicos** (5 columnas: Peso, % Grasa, Masa Libre de Grasa, Agua Corporal, Masa Ósea): valor actual, rango saludable y una barra de estado (Bajo / En rango / Elevado) calculada comparando el valor con el rango.
6. **Análisis Segmental** (5 columnas: tronco, brazo derecho, brazo izquierdo, pierna derecha, pierna izquierda): % grasa, masa grasa, masa magra y masa total por zona.
7. **Simetría Lateral Bilateral** (2 columnas: tren superior, tren inferior): diferencia porcentual, masa magra de cada lado y observación clínica localizada.

El informe se pagina automáticamente (salto de página) si el contenido no cabe en una sola hoja A4, y respeta el idioma del paciente (`"es"` / `"en"`) igual que el JSON de `GET /measurements/latest`.

---

## 4. Escenarios de error

| Escenario | Código HTTP | Mensaje (`error`) | Cuándo ocurre |
|---|---|---|---|
| Tenant no existe | `404` | `Tenant not found` | `tenantId` inválido o de otro tenant |
| Usuario no existe | `404` | `User not found` | `userId` inválido |
| El paciente no tiene ninguna medición registrada | `404` | `Measurement not found` | Nunca se ha registrado un `body_measurement` para el paciente |
| Hay medición pero faltan datos mínimos para calcular composición | `404` | `Body composition data unavailable` | Por ejemplo, falta la altura o el sexo del paciente y no se puede calcular el `BodyCompositionReport` |

Todos los errores siguen el formato estándar del backend: `{ "error": "mensaje" }`.

---

## 5. Checklist de implementación para frontend

- [ ] Añadir un botón "Descargar PDF" / "Ver informe" en la pantalla del dashboard de composición corporal, que llame a `GET /tenant/{tenantId}/users/{userId}/measurements/pdf`.
- [ ] Configurar la petición para recibir **datos binarios** (p. ej. `responseType: 'blob'` en Angular/HttpClient, o `Uint8List` con Dio en Flutter), no JSON.
- [ ] Abrir el PDF resultante con el visor disponible en la plataforma (blob URL en web, o un paquete tipo `printing` / `flutter_pdfview` / `open_file` en la app Flutter).
- [ ] Manejar los 4 escenarios de `404` de forma diferenciada, mostrando al usuario un mensaje adecuado según el `error` recibido — en particular, distinguir "sin mediciones" (`Measurement not found`) de "datos insuficientes para el cálculo" (`Body composition data unavailable`), ya que requieren acciones distintas (registrar una medición vs. completar el perfil del paciente).
- [ ] El botón debe respetar la misma visibilidad que el resto de la pantalla de composición corporal (permiso `VIEW_USER` o ser el propio paciente) — no requiere lógica de permisos nueva.

---

## 6. Ficheros modificados / creados

| Ruta | Cambio |
|---|---|
| `service/BodyCompositionPdfService.java` | Nuevo — genera el PDF con PDFBox a partir del `BodyCompositionReport` |
| `controller/BodyMeasurementController.java` | Modificado — añade `GET /measurements/pdf` |
| `exception/ErrorResource.java` | Modificado — añade `COMPOSITION_DATA_UNAVAILABLE` |
| `test/.../controller/BodyMeasurementControllerTest.java` | Modificado — añade `PdfTests` |
| `README.md` | Modificado — documenta el nuevo endpoint |
