# Chicago Travel OS — Estado de implementación

Última actualización: 2026-08-09  
Rama principal: `main`

Este documento resume las funcionalidades recientes, su estado de merge y cómo probarlas.

---

## Resumen por funcionalidad

| Funcionalidad | Estado | Commit / PR | Dónde probar |
|---|---|---|---|
| Documentos/tickets en lugares | **Mergeado — listo para probar** | PR #4 · `100af43` | Detalle de lugar en `/planificar` → adjuntar PDF/PNG/JPG/.pkpass |
| Sugerencias de lugares con IA | **Mergeado — listo para probar** | PR #5 · `acf3ad5` | `/preferencias` + panel **Sugerir lugares** en `/planificar` |
| Restricciones por día (focus + hora límite) | **Mergeado — listo para probar** | PR #6 · `44130f7` | `/planificar` (focus/hora por día) + vuelo en `/preferencias` |
| Datos de vuelo/hotel (manual + IA) | **Mergeado — listo para probar** | PR #7 · `6c4e79b` | `/preferencias` → **Datos del viaje**; resumen en `/dashboard` y `/hoy` |
| Fechas reales en `/planificar` | **Mergeado — listo para probar** | `096d3d3` | `/preferencias` (fecha inicio) → `/planificar` (tabs con fechas) |
| Notificaciones push late check-in | **Mergeado — listo para probar** | PR #8 · `67c79b5` | `/dashboard` (push + toggle) + cron API |
| Pasada UI/UX (design system) | **Mergeado — listo para probar** | `4170f7c` | Toda la app (tabs, toasts, estados vacío/error/loading) |

---

## Última tarea completada: fechas reales en `/planificar`

### Qué hace

- Calcula el calendario de los 4 días a partir de una **fecha ancla** con esta prioridad:
  1. `trips.start_date` (campo editable en `/preferencias`)
  2. Fecha de `hotel_checkin`
  3. Fecha de `flight_arrival`
- Muestra fechas formateadas en **tabs** y **encabezado del día** (ej. `Día 3 · dom, 12 ago 2026 · Compras`).
- Si `itinerary_days.date` está vacío, lo **rellena automáticamente** en Supabase (sin sobrescribir fechas ya guardadas).
- Las fechas resueltas también alimentan el optimizador (p. ej. coincidencia del día del vuelo de regreso).

### Archivos clave

- `src/lib/trips/trip-calendar.ts` — lógica de ancla, cálculo y formato
- `src/lib/itinerary/sync-day-dates.ts` — persistencia en `itinerary_days.date`
- `src/lib/itinerary/load-planning-data.ts` — carga con fechas resueltas
- `src/components/planificar/planning-board.tsx` — UI de tabs y encabezados

### Cómo probar

1. Ve a **`/preferencias`** → **Calendario** → captura **Fecha de inicio del viaje (Día 1)** → Guardar.
2. Abre **`/planificar`**.
3. Verifica que cada tab muestre la fecha real (ej. `Día 2 · lun, 11 ago 2026`).
4. Confirma el texto *“Fechas calculadas desde fecha de inicio del viaje”*.
5. En Supabase, revisa que `itinerary_days.date` se haya poblado para días que estaban en `null`.

**Respaldo sin `start_date`:** deja vacía la fecha de inicio pero captura check-in o llegada del vuelo; las fechas se derivan de ahí.

---

## Detalle de funcionalidades mergeadas

### 1. Documentos/tickets (`100af43`)

- Bucket `trip-documents` + tabla `place_documents`
- Subida desde modal de detalle de lugar en `/planificar`

### 2. Sugerencias IA (`acf3ad5`)

- Preferencias de viajero en `/preferencias`
- Botón **Sugerir lugares** en `/planificar`
- Requiere `ANTHROPIC_API_KEY`

### 3. Restricciones por día (`44130f7`)

- `focus` por día → prioriza categoría en optimizador
- `day_end_override` manual o automático por vuelo de regreso
- UI en editor de día arriba de cada tab en `/planificar`

### 4. Datos vuelo/hotel (`6c4e79b`)

- Formulario manual + extracción IA desde texto de confirmación
- Día 1 del optimizador usa `flight_arrival + 2 h` como inicio
- Recordatorios en `/dashboard` y `/hoy`

### 5. Push late check-in (`67c79b5`)

- Suscripción push en `/dashboard`
- Toggle `late_checkin_confirmed`
- Cron: `POST /api/cron/late-checkin-reminder`

**Variables de entorno (Railway):**

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Suscripción push en cliente |
| `VAPID_PRIVATE_KEY` | Envío push (nunca en repo) |
| `CRON_SECRET` | Protege el endpoint del cron |
| `SUPABASE_SERVICE_ROLE_KEY` | Cron lee suscripciones de todos los miembros |

**VAPID generadas (2026-08-09):**

- Pública: `BJa2KwEXHMi_LtOKCGwVael2kLBW3ssaOAeWlROc3EBDBzl-shTkIEAmZquE-u8s3uaiIe4Q8TocengKU1wL6aw`
- Privada: configurar solo en Railway

**Token cron sugerido:** `d4b6da042714b8c506374b5b7f9145ae38774eab4212791e`

**Probar notificación manual:**

```bash
curl -X POST "https://TU-APP.railway.app/api/cron/late-checkin-reminder?force=true" \
  -H "x-cron-secret: TU_CRON_SECRET"
```

### 6. UI/UX (`4170f7c`, `181d577`)

- Design system unificado, bottom tab bar, toasts, skeletons, empty/error states

---

## Commits recientes en `main`

```
67c79b5  Push late check-in reminders
6c4e79b  Trip travel info (vuelos/hotel + IA)
44130f7  Optimizer day constraints
4170f7c  Design system
acf3ad5  AI place suggestions
100af43  Place documents
```

*(Tras merge de fechas reales, `main` incluirá un commit adicional en esta línea.)*

---

## Pendientes conocidos

Ninguno crítico de la lista anterior. Posibles mejoras futuras (no iniciadas):

- Editar `itinerary_days.date` manualmente desde UI (hoy se deriva de ancla o Supabase)
- Notificaciones push programadas nativas en Railway (requiere cron configurado)
