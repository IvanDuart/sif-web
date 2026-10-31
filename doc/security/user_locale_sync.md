# Sincronización de Zona Horaria e Idioma del Usuario

Este documento detalla la integración necesaria en el Frontend y la App Móvil (Flutter) para sincronizar automáticamente el huso horario (timezone) y el idioma (language) del usuario logado con el backend, permitiendo que las notificaciones push en tiempo real se envíen localizadas y con las fechas formateadas correctamente según su región.

---

## 1. Cambios en el Backend

Se han añadido dos campos nuevos en la tabla `app_user`:
- **`timezone`**: Nombre de la zona horaria del estándar de IANA (p. ej., `Europe/Madrid`, `America/New_York`). Valor por defecto: `'Europe/Madrid'`.
- **`language`**: Código ISO del idioma (p. ej., `es`, `en`). Valor por defecto: `'es'`.

Estos campos son devueltos dentro de la información del usuario en el endpoint `GET /api/v1/users/me` bajo la vista `JsonViews.Me`.

---

## 2. Nuevo Endpoint de Actualización (Locale)

Para actualizar ambos campos al mismo tiempo de manera eficiente (por ejemplo, después de iniciar sesión o al detectar un cambio de configuración en el dispositivo), se ha habilitado un nuevo endpoint global:

| Método | Ruta | Permisos |
|---|---|---|
| `PATCH` | `/api/v1/users/me/locale` | Autenticado |

### Request Body
```json
{
  "timezone": "America/New_York",
  "language": "en"
}
```

- Ambos campos son obligatorios y no pueden estar vacíos.
- El valor de `timezone` debe ser un identificador de zona horaria válido en el estándar de IANA. El backend validará que sea correcto y, si no lo es, devolverá un error `400 Bad Request`.

### Response
- **`204 No Content`** — Actualizado con éxito.
- **`400 Bad Request`** — Timezone inválido u omitido.
- **`401 Unauthorized`** — Token JWT inválido o expirado.

---

## 3. Guía de Integración para Flutter (App Móvil)

El flujo ideal para sincronizar el estado del usuario es el siguiente:

### Paso A: Obtención de Datos del Sistema en Flutter
Podéis utilizar los siguientes mecanismos para obtener la configuración regional del sistema del usuario:

1. **Idioma:**
   ```dart
   import 'dart:io';
   
   // Obtiene el código del idioma local (p. ej. "es", "en")
   String localLanguage = Platform.localeName.split('_').first; 
   ```

2. **Zona Horaria:**
   Para obtener el string IANA completo de la zona horaria, se recomienda el paquete popular [flutter_timezone](https://pub.dev/packages/flutter_timezone):
   ```dart
   import 'package:flutter_timezone/flutter_timezone.dart';
   
   String localTimezone = await FlutterTimezone.getLocalTimezone(); // Retorna p. ej. "Europe/Madrid"
   ```

### Paso B: Envío al Backend tras iniciar sesión
Cada vez que el usuario inicie sesión con éxito (o la app detecte que ha arrancado y tiene sesión activa), debéis enviar una llamada al nuevo endpoint:

```dart
Future<void> syncUserLocale() async {
  try {
    String language = Platform.localeName.split('_').first;
    String timezone = await FlutterTimezone.getLocalTimezone();

    final response = await httpClient.patch(
      '/users/me/locale',
      data: {
        'timezone': timezone,
        'language': language,
      },
    );
    
    if (response.statusCode == 204) {
      print('Configuración regional sincronizada correctamente.');
    }
  } catch (e) {
    print('Error al sincronizar la configuración regional: $e');
  }
}
```

---

## 4. Efecto de la Sincronización en las Notificaciones

Una vez sincronizado el huso horario y el idioma en la base de datos, el backend utilizará esta información para enviar notificaciones push a través de **OneSignal**:

1. **Traducción Automática:** Las plantillas de mensajes se traducen automáticamente en el backend según el valor del campo `language` del destinatario (nutricionista o paciente). Actualmente soporta Español e Inglés (con fallback a español).
2. **Formato Horario Localizado:** En lugar de enviar la fecha de la cita como un timestamp UTC crudo (p. ej. `2026-08-13T10:00:00Z`), el backend la formatea usando el huso horario configurado en el campo `timezone` del usuario. La fecha aparecerá en el cuerpo del mensaje push formateada como `dd/MM/yyyy HH:mm` (p. ej. `13/08/2026 12:00` si está en UTC+2).
