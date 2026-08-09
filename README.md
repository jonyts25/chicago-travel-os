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

3. Completa `.env.local` con los valores de tu proyecto Supabase (Settings → API):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL` (opcional en local; útil en producción)

4. En Supabase → Authentication → Providers, habilita **Email** (login con contraseña).

5. Crea los usuarios manualmente en Authentication → Users (no hay registro público en la app).

6. Arranca el proyecto:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). Login en `/login`, ruta protegida de ejemplo en `/dashboard`.

## Despliegue en Railway

1. Conecta este repositorio en [Railway](https://railway.app/) y crea un servicio desde el repo.
2. Railway detectará Next.js. Comandos por defecto:
   - **Build**: `npm run build`
   - **Start**: `npm run start`
3. En **Variables** del servicio, configura:

| Variable | Descripción |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon/public key de Supabase |
| `NEXT_PUBLIC_SITE_URL` | URL pública de la app (ej. `https://tu-app.up.railway.app`) |
| `GOOGLE_PLACES_API_KEY` | API key server-side para resolver coordenadas vía Places API (Legacy Details con `ftid`) |

4. Genera un dominio público en Railway (Settings → Networking → Generate Domain).
5. Redeploy después de guardar variables.

La app queda instalable como PWA en móvil y desktop una vez desplegada con HTTPS. La sesión persiste entre aperturas (cookies de Supabase Auth).

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run start` — servidor de producción
- `npm run lint` — ESLint

## Fase actual

Fase 1: importación de lugares desde Google Takeout en `/import` (CSV o `Saved Places.json`). Mapa y edición de lugares pendientes.

### Importar lugares (Google Takeout)

1. Ve a [Google Takeout](https://takeout.google.com/) → desmarca todo excepto **Maps**.
2. Exporta la lista **Saved** (CSV con columnas `Título`, `Nota`, `URL`, `Etiquetas`, `Comentario`).
3. Habilita **Places API** (Legacy) en [Google Cloud Console](https://console.cloud.google.com/) y crea una API key restringida a esa API.
4. Agrega `GOOGLE_PLACES_API_KEY` en Railway (solo servidor, sin prefijo `NEXT_PUBLIC_`).
5. Sube el CSV en `/import`.

**Resolución de coordenadas:** el parser extrae el identificador `0xHEX:0xHEX` de la URL (patrón `!1s…`) y llama a Place Details Legacy:

`GET https://maps.googleapis.com/maps/api/place/details/json?ftid=0x…:0x…&fields=geometry,formatted_address,types&key=…`

**Deduplicación:** solo por `google_place_id` (CID/`!1s`) dentro del trip Chicago — dos "Trader Joe's" con IDs distintos se importan ambos.

**Costo aproximado:** 1 request Place Details por lugar nuevo (~$17 USD / 1.000 requests en el SKU Legacy "Places Details" con campos básicos; el tier Essentials nuevo ronda ~$5 / 1.000). Google suele incluir crédito mensual en cuentas nuevas. Para ~50 lugares ≈ $0.25–$0.85.

Un CSV de ejemplo está en `fixtures/google-takeout-chicago.sample.csv`.
