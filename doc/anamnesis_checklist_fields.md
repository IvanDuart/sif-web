# Estandarización de los Campos de Anamnesis (Historial Patológico)

## Contexto
Se han actualizado los campos del historial patológico (anamnesis) del paciente en el backend para abandonar los campos de texto genéricos (como `diseases` o `medicalHistory`) y pasar a un formato de **checklist estructurado con 18 condiciones médicas específicas**, basado en los requerimientos nutricionales.

Cada condición cuenta con dos campos en la API:
1. Un flag **Booleano** que indica si el paciente padece la condición (`hasX`).
2. Un campo de **Texto** opcional para observaciones adicionales (`XNotes`).

## Endpoints Afectados

Los campos se han añadido a los DTOs de lectura y escritura del perfil del inquilino del usuario:

- **Obtener Perfil:** `GET /api/tenant/{tenantId}/users/{userId}/tenant-profile`
- **Actualizar Perfil (Upsert):** `PUT /api/tenant/{tenantId}/users/{userId}/tenant-profile`

## Nuevos Campos en el Payload JSON (DTO)

Se deben incluir los siguientes 36 campos dentro del objeto JSON del perfil del paciente. Los booleanos deben ser enviados como `true` o `false` (por defecto serán considerados 'false' a nivel de DB si nunca se han inicializado), y las notas como cadenas de texto (String) u omitirse / enviar null.

### 1. Diabetes
- `hasDiabetes` (Boolean)
- `diabetesNotes` (String)

### 2. Tensión Arterial (Hipertensión)
- `hasHypertension` (Boolean)
- `hypertensionNotes` (String)

### 3. Corazón (Enfermedad cardíaca)
- `hasHeartDisease` (Boolean)
- `heartDiseaseNotes` (String)

### 4. Colesterol
- `hasCholesterol` (Boolean)
- `cholesterolNotes` (String)

### 5. Alergias / Asma
- `hasAllergiesAsthma` (Boolean)
- `allergiesAsthmaNotes` (String)

### 6. Hígado (Enfermedad hepática)
- `hasLiverDisease` (Boolean)
- `liverDiseaseNotes` (String)

### 7. Vesícula (Problemas biliares)
- `hasGallbladderDisease` (Boolean)
- `gallbladderDiseaseNotes` (String)

### 8. Riñones (Problemas renales)
- `hasKidneyDisease` (Boolean)
- `kidneyDiseaseNotes` (String)

### 9. Estómago (Problemas gástricos)
- `hasStomachDisease` (Boolean)
- `stomachDiseaseNotes` (String)

### 10. Ácido Úrico / Gota
- `hasUricAcidGout` (Boolean)
- `uricAcidGoutNotes` (String)

### 11. Circulación
- `hasCirculationIssues` (Boolean)
- `circulationIssuesNotes` (String)

### 12. Tiroides
- `hasThyroidIssues` (Boolean)
- `thyroidIssuesNotes` (String)

### 13. Anemia
- `hasAnemia` (Boolean)
- `anemiaNotes` (String)

### 14. Estreñimiento
- `hasConstipation` (Boolean)
- `constipationNotes` (String)

### 15. Músculo-esquelético
- `hasMusculoskeletalIssues` (Boolean)
- `musculoskeletalIssuesNotes` (String)

### 16. Operaciones / Cirugías
- `hasSurgeries` (Boolean)
- `surgeriesNotes` (String)

### 17. Ciclo Menstrual
- `hasMenstrualCycleIssues` (Boolean)
- `menstrualCycleIssuesNotes` (String)

### 18. Sueño (Problemas de descanso)
- `hasSleepIssues` (Boolean)
- `sleepIssuesNotes` (String)

## Ejemplo de Payload JSON (Fragmento)

```json
{
  "consultationReason": "Bajar de peso",
  
  "hasDiabetes": true,
  "diabetesNotes": "Diabetes Tipo II diagnosticada hace 3 años",
  
  "hasHypertension": false,
  "hypertensionNotes": null,

  "hasHeartDisease": false,
  "heartDiseaseNotes": "",
  
  "hasAllergiesAsthma": true,
  "allergiesAsthmaNotes": "Alergia al polen",

  "...": "Resto de los campos genericos (lifestyle, exercise, etc)..."
}
```

## Consideraciones para el Frontend

1. **Interfaz de checklist**: La aproximación esperada en la app de celular/panel será mostrar una lista de switches/checkboxes y, si el usuario marca "Sí" (true), revelar un text field adicional abajo/lado para ingresar la nota (las *Notes*).
2. Para simplificar, si un boolean se envía en `false`, los developers pueden opcionalmente borrar/limpiar o enviar en `null` el equivalente `*Notes` field para evitar mantener datos desactualizados en las observaciones clínicas si el paciente deja de padecer la condición o marca accidentalmente y se arrepiente.
3. Los campos pre-existentes heredados y genéricos (como `diseases` y `medicalHistory`) de momento se mantendrán en las clases por compatibilidad si es que se ha guardado información previa en ellos, pero progresivamente deberían dejarse en desuso de cara a los pacientes nuevos en favor de estas propiedades especializadas.
4. Las keys de las propiedades mencionadas en esta guía han sido inyectadas a nivel del array del módulo de preferencias de `activeAnamnesisFields` en el backend, por lo que deberían mostrarse/sincronizarse de manera natural con el payload si el tenant tiene configurado qué campos del perfil son obligatorios.
