# Lista de la compra IA — Categorías por supermercado (cambios para la app móvil)

Documento de apoyo para el equipo de la **app móvil**. Recoge los cambios
implementados en el backend en la generación de la lista de la compra con IA
(`ShoppingListService`) para que la app pueda **adaptar el renderizado por
secciones** de supermercado.

> Resumen en una frase: la lista ahora se categoriza con las **secciones reales
> de cada cadena** (no una lista genérica), se ordena siguiendo el recorrido del
> supermercado en lugar de por aparición, y se añade el supermercado **Mas y Mas**.
> El contrato HTTP **no cambia**: sigue siendo el mismo JSON de siempre.

---

## 1. Qué cambia (y qué no)

### Cambia

1. **El valor del campo `category`** de cada ítem. Antes la IA devolvía categorías
   genéricas e inconsistentes (`"Carnes"`, `"Otros"`, `"Despensa"`…) y a veces
   metía el pescado o las conservas en `"Otros"`. Ahora devuelve **secciones
   concretas de supermercado** (`"Pescadería"`, `"Conservas y Legumbres"`, …).
2. **Las categorías dependen del supermercado** elegido. Cada cadena tiene su
   propio conjunto y sus propios nombres de sección (Mercadona no se organiza
   igual que Lidl). Ver [§3](#3-taxonomía-de-secciones-por-supermercado).
3. **El orden de los ítems** (`sortOrder`) ahora agrupa por sección y sigue el
   orden de esas secciones (recorrido tipo pasillo a pasillo).
4. **Nuevo supermercado**: `MASYMAS` (véase [§6](#6-supermercados)).

### No cambia

- **Endpoints, peticiones y respuestas**: mismos DTOs, mismos nombres de campo,
  mismos códigos de error. Nada que migrar en la capa de red.
- El campo `estimatedPrice` sigue siendo un **precio estimado simulado** (no real).
- `totalEstimatedPrice`, `checked`, `notes`, `quantity`, `unit`, `name`, `id`,
  `sortOrder`, `supermarket`, `aiModel`, `createdAt` siguen igual.

---

## 2. El campo `category` en la respuesta

Cada `item` de la lista sigue teniendo esta forma:

```json
{
  "id": "b2c3d4e5-...",
  "name": "Merluza",
  "quantity": 0.8,
  "unit": "kg",
  "category": "Pescadería",
  "estimatedPrice": 9.90,
  "checked": false,
  "notes": "",
  "sortOrder": 3
}
```

**Lo único que debe adaptar la app**: `category` ya no es un valor de un catálogo
fijo de la app. Es el **nombre de una sección** que varía según el
`supermarket` de la lista. Por tanto:

- No conviene mantener un enum cerrado de categorías en el cliente: la lista de
  valores válidos **depende del supermercado** y puede crecer.
- Se recomienda **renderizar la sección a partir del texto** que llega en
  `category` (encabezado de sección), y usar un **mapa de iconos/colores con
  fallback** para las categorías conocidas.

---

## 3. Taxonomía de secciones por supermercado

El orden en que se listan las secciones a continuación **es el orden real** en
que se devuelven los ítems (el backend ordena los items respetando este orden, y
`sortOrder` es creciente). Es decir: los ítems llegan ya agrupados por sección y
en el orden de supermercado.

### MERCADONA

1. Fruta y Verdura
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas, Caldos y Cremas
8. Arroz, Pasta y Legumbres
9. Cereales y Galletas
10. Aceite, Especias y Salsas
11. Congelados
12. Agua y Refrescos
13. Bebidas Alcohólicas
14. Aperitivos y Frutos Secos
15. Dulces y Chocolate
16. Desayuno y Café
17. Droguería y Limpieza
18. Cuidado e Higiene

### CARREFOUR

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería y Pastelería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pastas, Arroces y Cereales
9. Aceites, Salsas y Especias
10. Congelados
11. Bebidas
12. Aperitivos y Snacks
13. Dulces y Repostería
14. Desayuno e Infantil
15. Droguería y Limpieza
16. Perfumería e Higiene

### LIDL

1. Frutas y Verduras
2. Carne y Aves
3. Pescado y Marisco
4. Charcutería y Quesos
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta, Arroz y Cereales
9. Salsas y Condimentos
10. Congelados
11. Bebidas
12. Dulces y Snacks
13. Desayuno
14. Limpieza y Hogar
15. Higiene Personal

### ALCAMPO

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta, Arroz y Cereales
9. Aceites y Condimentos
10. Congelados
11. Bebidas
12. Aperitivos
13. Dulces y Repostería
14. Droguería y Limpieza
15. Higiene

### DIA

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta y Arroz
9. Cereales y Desayuno
10. Aceites y Salsas
11. Congelados
12. Bebidas
13. Snacks y Frutos Secos
14. Limpieza
15. Higiene Personal

### EL_CORTE_INGLES

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería y Quesos
5. Panadería y Pastelería
6. Lácteos y Huevos
7. Conservas y Gourmet
8. Pasta, Arroz y Legumbres
9. Aceites, Salsas y Especias
10. Congelados
11. Bodega y Bebidas
12. Aperitivos y Frutos Secos
13. Dulces y Repostería
14. Droguería y Limpieza
15. Perfumería e Higiene

### ALDI

1. Frutas y Verduras
2. Carne
3. Pescado
4. Charcutería y Quesos
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta, Arroz y Cereales
9. Salsas y Condimentos
10. Congelados
11. Bebidas
12. Dulces y Snacks
13. Desayuno
14. Limpieza
15. Higiene

### EROSKI

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta, Arroz y Cereales
9. Aceites y Condimentos
10. Congelados
11. Bebidas
12. Aperitivos y Frutos Secos
13. Dulces y Repostería
14. Droguería y Limpieza
15. Higiene Personal

### CONSUM

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta, Arroz y Cereales
9. Aceites, Salsas y Especias
10. Congelados
11. Bebidas
12. Aperitivos y Snacks
13. Dulces y Repostería
14. Droguería y Limpieza
15. Higiene Personal

### HIPERCOR

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería y Quesos
5. Panadería y Pastelería
6. Lácteos y Huevos
7. Conservas y Gourmet
8. Pasta, Arroz y Legumbres
9. Aceites, Salsas y Especias
10. Congelados
11. Bodega y Bebidas
12. Aperitivos y Frutos Secos
13. Dulces y Repostería
14. Droguería y Limpieza
15. Perfumería e Higiene

### MASYMAS

1. Frutas y Verduras
2. Carnicería
3. Pescadería
4. Charcutería
5. Panadería
6. Lácteos y Huevos
7. Conservas y Legumbres
8. Pasta y Arroz
9. Cereales y Desayuno
10. Aceites y Condimentos
11. Congelados
12. Bebidas
13. Snacks y Frutos Secos
14. Limpieza e Higiene

---

## 4. Orden de los ítems y `sortOrder`

- Los ítems llegan **ya agrupados por sección y ordenados** siguiendo el orden de
  la sección en la tabla anterior. No es necesario reordenar en la app.
- `sortOrder` es un entero creciente empezando en `0`. Refleja ese mismo orden,
  de modo que la app puede **agrupar por `category`** conservando el orden de
  `sortOrder` para obtener los encabezados de sección en el orden del súper.
- Ejemplo de renderizado esperado:

  ```
  ▸ Frutas y Verduras
      · Tomate         sortOrder 0
      · Cebolla        sortOrder 1
  ▸ Carnicería
      · Pechuga de pollo   sortOrder 2
  ▸ Pescadería
      · Merluza            sortOrder 3
  ```

---

## 5. Compatibilidad con listas antiguas

Las listas **ya generadas antes de este cambio** conservan su categorización
antigua (`"Carnes"`, `"Otros"`, `"Despensa"`, …) porque los ítems están
persistidos en base de datos. La app puede encontrarse con:

- Categorías antiguas que **no existen** en las tablas de la sección 3 (p. ej.
  `"Otros"`).
- Categorías con nombres ligeramente distintos entre cadenas.

**Recomendación**: tratar `category` siempre como texto libre con un **icono/
color por defecto** para cualquier valor desconocido, en lugar de lanzar o
ignorar el ítem. Solo las listas generadas a partir del deploy tendrán las
secciones nuevas.

---

## 6. Supermercados

Se añade **`MASYMAS`** a los valores admitidos en el campo `supermarket`:

| Valor | Nombre mostrado |
|---|---|
| MERCADONA | Mercadona |
| CARREFOUR | Carrefour |
| LIDL | Lidl |
| ALCAMPO | Alcampo |
| DIA | Dia |
| EL_CORTE_INGLES | El Corte Inglés |
| ALDI | Aldi |
| EROSKI | Eroski |
| CONSUM | Consum |
| HIPERCOR | Hipercor |
| **MASYMAS** | **Mas y Mas** |

Si la app tiene una lista cerrada de supermercados con etiqueta/logo, debe
**añadir `MASYMAS`** para no mostrarlo vacío.

---

## 7. Modelo de IA y precios

- El campo `aiModel` de la lista ahora vale **`gemini-3.1-flash-lite`** (antes
  `gemini-2.0-flash`). Si la app lo muestra en algún sitio, conviene no
  hardcodear el texto.
- Los precios siguen siendo **estimaciones simuladas** ajustadas al perfil de
  precios de cada cadena (marca blanca, descuento, premium…). No proceden de una
  tarifa real ni de una API de precios.

---

## 8. Ejemplo de respuesta completo

```json
{
  "id": "a1b2c3d4-...",
  "menuId": "7c9e6679-...",
  "appUserId": "f47ac10b-...",
  "name": "Shopping list - Menu semanal - Mercadona",
  "supermarket": "MERCADONA",
  "totalEstimatedPrice": 61.20,
  "aiModel": "gemini-3.1-flash-lite",
  "createdAt": "2026-10-01T10:00:00Z",
  "items": [
    { "id": "…", "name": "Tomate",          "quantity": 1.0, "unit": "kg", "category": "Fruta y Verdura",            "estimatedPrice": 2.19, "checked": false, "notes": "", "sortOrder": 0 },
    { "id": "…", "name": "Pechuga de pollo","quantity": 1.5, "unit": "kg", "category": "Carnicería",                  "estimatedPrice": 9.75, "checked": false, "notes": "Preferible sin piel", "sortOrder": 1 },
    { "id": "…", "name": "Merluza",         "quantity": 0.8, "unit": "kg", "category": "Pescadería",                  "estimatedPrice": 9.90, "checked": false, "notes": "", "sortOrder": 2 },
    { "id": "…", "name": "Atún en conserva","quantity": 3.0, "unit": "unidades", "category": "Conservas, Caldos y Cremas", "estimatedPrice": 3.60, "checked": false, "notes": "", "sortOrder": 3 }
  ]
}
```

---

## 9. Checklist de adaptación para la app móvil

- [ ] Dejar de tratar `category` como un enum fijo y renderizarlo como sección a
      partir del texto recibido.
- [ ] Añadir un **mapa de iconos/colores** por nombre de sección, con **fallback**
      para valores desconocidos.
- [ ] Agrupar los ítems por `category` respetando `sortOrder` para pintar los
      encabezados de sección en orden de supermercado.
- [ ] Añadir el supermercado `MASYMAS` a la lista de supermercados seleccionables
      con su etiqueta («Mas y Mas»).
- [ ] No hardcodear el valor de `aiModel`.
- [ ] Verificar el render con una lista antigua (con `"Otros"`) y con una nueva.

---

## Referencias

- Documentación base del feature: [`doc/ai/ai-shopping-list.md`](ai-shopping-list.md).
- Backend: `service/ShoppingListService.java` (composición del prompt y
  categorización) y `models/entity/Supermarket.java` (secciones y perfil de
  precios por cadena).
