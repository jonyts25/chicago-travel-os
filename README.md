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
2. Elige una de estas opciones de exportación:
   - **Maps (your places)** → genera `Saved Places.json` (GeoJSON con coordenadas).
   - **Saved** → genera CSVs por lista (ej. `Chicago.csv`, `Want to go.csv`) con columnas `Title`, `URL`, etc.
3. Descomprime el ZIP y sube **un archivo** `.json` o `.csv` en `/import`.
4. Revisa el resumen: importados vs duplicados.

Los duplicados se detectan por `google_place_id` o por proximidad de coordenadas (~50 m) dentro del trip Chicago.
