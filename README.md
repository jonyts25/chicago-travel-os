# Chicago Travel OS

PWA privada para planificar un viaje de 4 días a Chicago. Stack: Next.js (App Router), TypeScript, Tailwind CSS y Supabase (Auth + Postgres).

## Requisitos

- Node.js 20+
- Proyecto Supabase con las tablas ya creadas (`users`, `trips`, `trip_members`, `places`, `itinerary_days`, `itinerary_items`)

## Configuración local

1. Instala dependencias:

```bash
npm install
```

2. Copia las variables de entorno:

```bash
cp .env.local.example .env.local
```

3. Completa `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NOMINATIM_USER_AGENT` — obligatorio para geocoding (ej. `ChicagoTravelOS/1.0 (tu@email.com)`)
- `ANTHROPIC_API_KEY` — opcional, enriquecimiento IA (categoría, nombre limpio, duración)

4. En Supabase → Authentication → Providers, habilita **Email** (login con contraseña).

5. Crea los usuarios manualmente en Authentication → Users.

6. Arranca el proyecto:

```bash
npm run dev
```

## Despliegue en Railway

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app |
| `NOMINATIM_USER_AGENT` | User-Agent para Nominatim (con tu email) |
| `ANTHROPIC_API_KEY` | Opcional — categorización con Haiku |

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run start` — servidor de producción
- `npm run lint` — ESLint
- `npm run import:dry-run -- fixtures/tu-lista.csv` — prueba parser + Nominatim + IA sin Supabase

## Fase actual

Fase 1: importación de lugares desde Google Takeout en `/import`.

### Importar lugares (Google Takeout → Saved)

1. [Google Takeout](https://takeout.google.com/) → **Maps** → exporta lista **Saved** (CSV).
2. Columnas: `Título`, `Nota`, `URL`, `Etiquetas`, `Comentario`.
3. Sube el CSV en `/import` (requiere login).

**Parser:** nombre desde `Título`, CID (`!1s0xHEX:0xHEX`) → `google_place_id`, URL completa → `maps_url`, notas combinadas.

**Geocoding:** Nominatim (`nombre + ", Chicago, IL"`), 1 request/segundo, sin API key.

**IA (opcional):** Haiku infiere categoría (`Museo`, `Restaurante`, `Compras`, `Atracción`, `Café`, `Otro`), limpia el nombre y asigna duración por defecto. Si falla, el lugar se importa igual.

**Deduplicación:** solo por `google_place_id` en el trip Chicago.

**Resumen:** importados, duplicados, sin coordenadas, sin categoría IA, filas sin CID.

### Mapa (`/map`)

Leaflet + tiles OpenStreetMap (`react-leaflet`). Sin token, sin cuenta, sin tarjeta. Muestra los lugares importados con coordenadas del trip Chicago.
