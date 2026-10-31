# Fortalezas de la plataforma — brief para landing

> **Qué es este documento:** fuente de verdad para redactar la landing promocional.
> Cada fortaleza lleva **(a)** el copy listo para web, **(b)** la prueba técnica que la
> respalda y **(c)** dónde colocarla. No inventar cifras ni capacidades que no estén aquí.
>
> **Fuentes:** `doc/` (55 documentos, ~12.200 líneas de contratos y guías) y
> `doc/api-docs.json` (OpenAPI 3.1: 80 rutas, 115 operaciones, 131 esquemas).

---

## 1. Posicionamiento

**Categoría:** software de gestión para clínicas y profesionales de nutrición, con marca blanca y app móvil propia.

**Idea central:** no vendemos "dietas bonitas"; vendemos **criterio clínico + tiempo recuperado + control del negocio**, en una plataforma que lleva la marca del centro.

**Contra qué competimos (uso interno, no nombrar en la landing):** Nutrium y Dietopro son fuertes en recetario, planificación por intercambios y engagement. Nosotros somos más fuertes en **composición corporal clínica**, **operativa de centro**, **multitenancy/marca blanca** y **control de datos e IA**.

**Frase de posicionamiento:**

> La plataforma clínica para centros de nutrición que quieren medir resultados, trabajar más rápido y mantener su propia marca.

---

## 2. Hero y mensajes principales

### Opción A — clínica
**H1:** Nutrición clínica con datos, no con intuición.
**Sub:** Composición corporal segmental, planes sobre base BEDCA y seguimiento real de cada paciente. Todo bajo la marca de tu centro.

### Opción B — negocio
**H1:** Tu clínica de nutrición, en una sola plataforma.
**Sub:** Agenda, pacientes, planes, app móvil y facturación de tu actividad. Menos horas de administración, más tiempo con el paciente.

### Opción C — marca blanca
**H1:** Tu marca. Tus pacientes. Tus datos.
**Sub:** Plataforma multi-centro con app móvil propia, roles por equipo y personalización completa. Sin depender de la marca de nadie.

**CTA principal:** Solicita una demo
**CTA secundario:** Ver la plataforma en 3 minutos
**Microcopy de confianza:** Sin permanencia · Datos alojados en la UE · Migración asistida

---

## 3. Las 10 fortalezas

### 1. Composición corporal clínica, no solo un número en la báscula

**Copy:** Analiza grasa, masa magra, agua, masa ósea y grasa visceral por zonas del cuerpo. Detecta asimetrías entre lado derecho e izquierdo, calcula la complexión física y compara cada valor con rangos de referencia personalizados por sexo y edad. El paciente se lleva un informe profesional en PDF con tu marca.

**Prueba técnica:** 10 métricas segmentales (tronco, brazos y piernas) + grasa visceral, agua corporal, masa ósea, perímetros y muñeca; índice de Grant; simetría bilateral; rangos clínicos con semáforo; informe PDF en español e inglés; histórico por centro (`doc/body_composition_and_segmental_measurements.md`, `doc/pdf-composicion-corporal.md`).

**Dónde va:** bloque "Resultados que se ven", con captura del informe y del análisis segmental.

---

### 2. Planes nutricionales sobre una base de alimentos profesional

**Copy:** Crea comidas eligiendo alimentos reales con su gramaje, no escribiendo frases. La plataforma calcula calorías y macronutrientes al instante, permite clonar días completos y reutilizar plantillas. Si tu centro prefiere el método clásico, sigue escribiendo el menú a mano: los dos modos conviven.

**Prueba técnica:** catálogo BEDCA con 48 nutrientes, alimentos propios del centro, recetas, `items[]` con gramaje, totales por comida/día/menú, `copy-day`, plantillas e instanciación, modo `MANUAL` o `BEDCA` por tenant (`doc/menus-estructurados-bedca-frontend.md`).

**Dónde va:** bloque "Planifica en minutos", con GIF del editor y el cálculo de macros.

---

### 3. Una app móvil para el paciente y para el profesional

**Copy:** Tus pacientes consultan su dieta, su evolución, su consumo de agua y sus informes desde el móvil. Reciben recordatorios de cita y avisos al instante. Tú gestionas desde la app o desde el panel web, con los mismos datos.

**Prueba técnica:** app Flutter para paciente y nutricionista; push con OneSignal; solicitud y reagendamiento de cita desde la app; dieta, evolución, agua y PDFs; control de versión mínima de la app (`doc/citas_pacientes_onesignal.md`, `doc/appointment_reminders.md`, `doc/relacion_paciente_nutricionista.md` §7, `GET/PUT /api/v1/app/version`).

**Dónde va:** bloque "Tu clínica en el bolsillo", con mockups de iOS/Android.

---

### 4. Agenda que reduce ausencias y se llena sola

**Copy:** Tipos de cita con duración y precio, recordatorios automáticos, solicitudes de cita desde la app y reagendamiento en un clic. Bloquea vacaciones y horas personales, y evita solapamientos sin pensarlo.

**Prueba técnica:** tipos de cita, detección de solapes, citas sin paciente, estados `SCHEDULED/COMPLETED/CANCELLED/NO_SHOW/PROPOSED`, recordatorios push el día antes y el mismo día, notas y bloqueos de calendario, horarios y festivos del centro con carga automática de festivos oficiales (`doc/appointments.md`, `doc/appointment_reminders.md`, `doc/calendario_notas_nutricionista_frontend.md`, `doc/horarios_centros.md`).

**Dónde va:** bloque "Menos ausencias, más consultas", con el calendario y la curva de asistencia.

---

### 5. El negocio bajo control

**Copy:** Sabe cuánto has ingresado, cuánto vale tu consulta media y cuántas citas se han perdido. Compara profesionales, tipos de servicio y franjas horarias. El precio de cada cita queda congelado: tus informes históricos no cambian cuando subes tarifas.

**Prueba técnica:** precio en tipo de cita y snapshot inmutable en la cita; ingresos por rango; métricas agregadas de ingresos, asistencia, no-show, ticket medio, pacientes atendidos, desglose por nutricionista/servicio/franja y series temporales (`doc/EXECUTIVE_SUMMARY.md`, `doc/metricas_asistencia_frontend.md`).

**Dónde va:** bloque "Decisiones con números", con dashboard de métricas.

---

### 6. Tu marca en todo lo que ve el paciente

**Copy:** Logo, color principal, idioma y datos de contacto del centro en la web, en la app y en cada PDF. Tus pacientes ven tu marca, no la nuestra.

**Prueba técnica:** branding público por tenant (logo web y logo PDF, color, idioma, dirección y teléfono); PDFs de menú y de composición corporal con cabecera del centro; preferencias por tenant (`doc/API.md` §3.1, `doc/menu-pdf-and-tenant-contact.md`, `doc/pdf-composicion-corporal.md`).

**Dónde va:** bloque "Marca blanca", con comparativa de dos centros con estilos distintos.

---

### 7. Multi-centro y equipos, de verdad

**Copy:** Gestiona varias sedes o varios profesionales desde una sola cuenta. Cada centro tiene sus pacientes, sus menús, sus precios y sus permisos. Un nutricionista puede trabajar en dos centros sin mezclar datos.

**Prueba técnica:** arquitectura multitenant con aislamiento por `tenant_id`; un usuario con varias membresías y un rol por centro; RBAC granular por endpoint (`ADMIN`, `NUTRITIONIST`, `PATIENT`); cartera de pacientes por nutricionista titular y suplencias (`doc/API.md`, `doc/relacion_paciente_nutricionista.md`, `doc/userType.md`).

**Dónde va:** bloque "Para clínicas y grupos", con diagrama de sedes/roles.

---

### 8. Datos clínicos estructurados, no un cajón de notas

**Copy:** Anamnesis con 18 condiciones médicas, cada una con su observación; alergias, medicación, digestión, ciclo hormonal y hábitos. Cada centro decide qué campos usa. La información queda ordenada y comparable, no escondida en un párrafo.

**Prueba técnica:** checklist de 18 condiciones con flag + notas, campos de anamnesis configurables por tenant (`active_anamnesis_fields`), perfil clínico separado por centro, observaciones y comidas fijas (`doc/anamnesis_checklist_fields.md`, `doc/water_intake_and_anamnesis_config.md`, `doc/patient_profile.md`).

**Dónde va:** bloque "Ficha clínica ordenada", con captura del checklist.

---

### 9. IA útil, con tus claves y tus costes

**Copy:** Genera la lista de la compra de un menú completo con cantidades y precios estimados por supermercado. Importa menús desde una foto o un PDF y ahórrate teclearlos. La IA se activa por centro y con la clave del centro: tú controlas el coste y los datos.

**Prueba técnica:** lista de la compra con Gemini a partir de las comidas del menú, precio estimado y supermercado; importación de menús por imagen/PDF con OCR/IA; `ai_enabled` y `gemini_api_key` por tenant (`doc/ai-shopping-list.md`, `doc/API.md` §3.2, `doc/menuTemplateUpload.md`).

**Dónde va:** bloque "La IA que te quita trabajo", con la lista de la compra y el importador.

---

### 10. Plataforma abierta e integrable

**Copy:** Exporta tus pacientes, conecta tu app o tu ERP y recibe cambios en tiempo real. No te encerramos en un formato propietario.

**Prueba técnica:** 115 operaciones REST documentadas, exportación CSV de usuarios, SSE para cambios de menú y notificaciones, sincronización de idioma/zona horaria del usuario, app Flutter sobre la misma API (`doc/api-docs.json`, `doc/sse-real-time-menu-frontend.md`, `doc/sse-notificaciones-frontend.md`).

**Dónde va:** bloque "Se integra con lo que ya usas", con logos genéricos de API/CSV/calendario.

---

## 4. Tres pilares para la home

| Pilar | Promesa | Prueba |
|---|---|---|
| **Clínica** | Decisiones con datos, no con impresiones | Composición corporal segmental + rangos + informes |
| **Tiempo** | Planifica y agenda en la mitad de tiempo | BEDCA + plantillas + importación IA + recordatorios |
| **Negocio** | Controla tu centro sin otra hoja de cálculo | Precios, ingresos, asistencia, multi-sede, marca blanca |

---

## 5. Mensajes por segmento

| Segmento | Dolor | Mensaje |
|---|---|---|
| **Nutricionista independiente** | Pierde horas haciendo menús y persiguiendo citas | "Haz el plan en minutos y deja que la agenda se llene sola." |
| **Clínica con varios profesionales** | No sabe qué pasa en cada sede ni quién atiende a quién | "Una plataforma, todas tus sedes y tu cartera de pacientes clara." |
| **Clínica mixta fisio + nutrición** | Dos softwares que no se hablan | "Fisioterapia y nutrición en el mismo centro, con la misma marca." |
| **Centro de nutrición deportiva / clínica** | Necesita datos finos, no solo peso | "Composición corporal segmental y evolución medible." |
| **Franquicia / grupo** | Necesita marca propia y datos agregados | "Marca blanca, permisos por centro y métricas comparables." |

---

## 6. Objeciones y respuestas

| Objeción | Respuesta |
|---|---|
| "Ya tengo mis menús en Word/PDF." | Se importan desde foto o PDF y se convierten en menús editables. También puedes seguir en modo texto. |
| "Mis pacientes no van a usar una app." | La app es opcional: reciben el plan en PDF y los recordatorios por push. La dieta, la evolución y el agua están en el móvil si la quieren. |
| "¿La IA me va a costar una fortuna?" | La clave de IA es del centro y se activa por centro. Tú decides cuándo usarla. |
| "¿Puedo cambiar de software?" | Exportación de usuarios y API documentada. Migración asistida. |
| "¿Y mis datos?" | Aislamiento por centro, roles por equipo y datos alojados en la UE. |
| "¿Sirve para varias sedes?" | Sí: multitenant, un usuario puede pertenecer a varios centros con roles distintos. |

---

## 7. Qué podemos afirmar y qué no (todavía)

**Afirmar sin problema:**
- Composición corporal segmental con informe PDF.
- Planes sobre BEDCA con 48 nutrientes y modo texto.
- App móvil para paciente y profesional.
- Recordatorios push y solicitudes de cita desde la app.
- Precios, ingresos y métricas de asistencia.
- Marca blanca y multi-centro.
- Anamnesis estructurada de 18 condiciones.
- Lista de la compra con IA y precios estimados.
- Exportación CSV y API documentada.

**No usar aún (no hay evidencia en `doc/`):**
- "Chat integrado" (no existe en el contrato).
- "Facturación electrónica" (solo cálculo de ingresos).
- "Generación automática de dietas por patología".
- "Recetario de miles de recetas" (hay recetas en el buscador, no una biblioteca gestionable).
- "Cumplimiento HIPAA" (GDPR/UE sí es defendible; HIPAA no está documentado).
- "El nº1", "el mejor", "líder del mercado".
- "IA incluida" (es clave propia del centro).
- "Historia clínica electrónica completa" (es perfil nutricional, no HCE).

---

## 8. Estructura sugerida de la landing

1. **Hero** con H1 + subtítulo + CTA + captura del dashboard.
2. **Barra de confianza** (cuando haya logos/testimonios reales).
3. **Tres pilares** (clínica, tiempo, negocio).
4. **Bloque clínico**: composición corporal + informe PDF.
5. **Bloque planificación**: editor BEDCA + macros + plantillas.
6. **Bloque agenda**: calendario + recordatorios + autoservicio.
7. **Bloque negocio**: ingresos, asistencia, ticket medio.
8. **Bloque app**: mockups iOS/Android + push.
9. **Bloque marca blanca**: dos centros, dos estilos.
10. **Bloque IA**: lista de la compra + importación.
11. **Bloque integración**: API, CSV, SSE.
12. **Testimonios** (pendiente de recopilar; no inventar).
13. **Pricing o "habla con nosotros"**.
14. **FAQ** con las objeciones de §6.
15. **CTA final** + formulario.

---

## 9. Pendiente para completar la landing

- [ ] 1 frase de cada cliente real (con permiso) y logo del centro.
- [ ] 2-3 capturas limpias: dashboard, editor de menú, informe de composición.
- [ ] Mockups de la app en iOS y Android.
- [ ] Métrica de impacto real (p. ej. "X minutos menos por plan", "Y puntos menos de no-show") medida en piloto.
- [ ] Definir precio/plan (no está en `doc/`).
- [ ] Revisión legal de claims (UE/GDPR) antes de publicar.
