# Perfil del paciente — datos médicos y sensibles

## 1. Resumen

Se añade una nueva tabla `user_tenant_profile` para almacenar datos **sensibles del paciente** (motivo de consulta, enfermedades, antecedentes, hábitos, estilo de vida, ejercicio y psique). Estos datos son **exclusivos por cada tenant**, con clave primaria compuesta `(user_id, tenant_id)` — exactamente un perfil por membresía de paciente en un tenant.

**Solo los roles `ADMIN` y `NUTRITIONIST`** pueden ver y editar esta información, protegida mediante los permisos `VIEW_PATIENT_PROFILE` y `MANAGE_PATIENT_PROFILE`.

---

## 2. Endpoints

### GET /tenant/{tenantId}/users/{userId}/profile

Obtiene el perfil médico del paciente.

**Permiso requerido:** `VIEW_PATIENT_PROFILE`

**Response 200:**
```json
{
  "consultationReason": "Pérdida de peso",
  "diseases": "Diabetes tipo 2, Hipertensión",
  "medicalHistory": "Cirugía de vesícula en 2020",
  "habits": "Fumador ocasional, 2 cafés al día",
  "lifestyle": "Trabajo de oficina, 8h sentado",
  "exercise": "Caminata 20min 3x semana",
  "psyche": "Estrés laboral moderado",
  "allergiesIntolerances": "Lactosa, frutos secos",
  "foodPreferences": "Dieta ovolactovegetariana",
  "medicationSupplements": "Metformina 850mg, Vitamina D3",
  "gastrointestinalStatus": "Digestión lenta, ocasional hinchazón",
  "hormonalCycle": "SOP, ciclo irregular"
}
```

Si el paciente aún no tiene perfil, todos los campos vuelven `null`:
```json
{
  "consultationReason": null,
  "diseases": null,
  "medicalHistory": null,
  "habits": null,
  "lifestyle": null,
  "exercise": null,
  "psyche": null,
  "allergiesIntolerances": null,
  "foodPreferences": null,
  "medicationSupplements": null,
  "gastrointestinalStatus": null,
  "hormonalCycle": null
}
```

### PUT /tenant/{tenantId}/users/{userId}/profile

Crea o actualiza el perfil médico del paciente (upsert).

**Permiso requerido:** `MANAGE_PATIENT_PROFILE`

**Request body — todos los campos son opcionales (semántica PATCH):**
```json
{
  "consultationReason": "Pérdida de peso y reeducación alimentaria",
  "diseases": "Diabetes tipo 2",
  "medicalHistory": "Cirugía de vesícula en 2020",
  "habits": "Fumador ocasional",
  "lifestyle": "Trabajo de oficina",
  "exercise": "Caminata 20min 3x semana",
  "psyche": "Estrés laboral moderado",
  "allergiesIntolerances": "Lactosa",
  "foodPreferences": "No le gusta el pescado",
  "medicationSupplements": "Metformina 850mg",
  "gastrointestinalStatus": "Hinchazón ocasional",
  "hormonalCycle": null
}
```

**Response 200** — el perfil completo actualizado (misma estructura que GET).

**Notas:**
- Si el perfil no existe previamente, se crea automáticamente al hacer PUT.
- Los campos no enviados o `null` se guardan como `null` en la base de datos.
- La respuesta siempre devuelve el estado actual completo después de guardar.

---

## 3. Tabla de campos

| Campo | Tipo | Descripción |
|---|---|---|
| `consultationReason` | `string` | Motivo de consulta |
| `diseases` | `string` | Enfermedades diagnosticadas |
| `medicalHistory` | `string` | Antecedentes médicos (cirugías, hospitalizaciones, etc.) |
| `habits` | `string` | Hábitos (tabaco, alcohol, cafeína, etc.) |
| `lifestyle` | `string` | Estilo de vida (trabajo, horarios, descanso) |
| `exercise` | `string` | Actividad física y ejercicio |
| `psyche` | `string` | Estado psicológico / emocional |
| `allergiesIntolerances` | `string` | Alergias e intolerancias alimentarias |
| `foodPreferences` | `string` | Preferencias, aversiones y tipo de dieta |
| `medicationSupplements` | `string` | Medicación y suplementación actual |
| `gastrointestinalStatus` | `string` | Estado gastrointestinal (digestión, ritmo intestinal, etc.) |
| `hormonalCycle` | `string` | Ciclo hormonal (SOP, menopausia, embarazo, lactancia, etc.) |

Todos los campos son de tipo `TEXT` en PostgreSQL y aceptan contenido largo sin límite práctico.

---

## 4. Seguridad — permisos

Se crean dos nuevos permisos a nivel de base de datos:

| Permiso | Descripción | Asignado a |
|---|---|---|
| `VIEW_PATIENT_PROFILE` | Ver perfil sensible del paciente | `ADMIN`, `NUTRITIONIST` |
| `MANAGE_PATIENT_PROFILE` | Editar perfil sensible del paciente | `ADMIN`, `NUTRITIONIST` |

El rol `USER` (paciente) **no tiene ninguno de estos permisos**, por lo que no puede acceder a su propio perfil ni al de otros pacientes.

### Ejemplo de comprobación en frontend

```typescript
// Si el usuario logado tiene el permiso en su rol actual
const canViewProfile = permissions.includes('VIEW_PATIENT_PROFILE');
const canManageProfile = permissions.includes('MANAGE_PATIENT_PROFILE');

if (canViewProfile) {
  // mostrar sección "Perfil médico"
}
```

Los permisos del usuario logado se obtienen desde `GET /me` en el campo `permissions` de cada membership.

---

## 5. Notas técnicas

- **Upsert**: el endpoint `PUT` hace un `INSERT ... ON CONFLICT UPDATE` (o su equivalente en JPA: `save()` con `findById()` previo). No necesita un `POST` aparte para crear.
- **Datos sensibles**: al ser `TEXT` sin restricción de longitud, el contenido puede ser tan extenso como sea necesario.
- **No hay histórico**: los datos reemplazan el valor anterior al hacer PUT. Si en el futuro se requiere auditoría, se añadirá una tabla de histórico separada.
- **Eliminación en cascada**: si el `user_tenant_role` se elimina (revocación de acceso), el perfil se elimina automáticamente por la FK `ON DELETE CASCADE`.

---

## 6. Ficheros modificados / creados

| Ruta | Cambio |
|---|---|---|
| `db/migration/V7__add_user_tenant_profile.sql` | Nuevo — crea tabla `user_tenant_profile` + permisos + asignación |
| `db/migration/V10__add_extended_anamnesis_fields.sql` | Nuevo — añade 5 campos de anamnesis extendida |
| `models/entity/UserTenantProfile.java` | Nuevo — entidad JPA con `@IdClass(UserTenantRoleId.class)` |
| `models/dto/UserTenantProfileDto.java` | Nuevo — DTO de respuesta |
| `controller/dto/UpdateUserTenantProfileRequest.java` | Nuevo — DTO de petición |
| `repository/UserTenantProfileRepository.java` | Nuevo — repositorio JPA |
| `service/UserTenantProfileService.java` | Nuevo — lógica de negocio con upsert |
| `controller/UserTenantRoleController.java` | Modificado — añade endpoints `GET/PUT /{userId}/profile` |
