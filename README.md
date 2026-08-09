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

4. En Supabase → Authentication → URL Configuration, agrega:

- **Site URL**: `http://localhost:3000` (local) y la URL pública de Railway (producción)
- **Redirect URLs**:
  - `http://localhost:3000/auth/callback`
  - `https://<tu-app>.up.railway.app/auth/callback`

5. Habilita **Email** provider con magic link en Authentication → Providers.

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
5. Actualiza en Supabase la **Site URL** y **Redirect URLs** con tu dominio de Railway (`https://<tu-app>.up.railway.app/auth/callback`).
6. Redeploy después de guardar variables.

La app queda instalable como PWA en móvil y desktop una vez desplegada con HTTPS.

## Scripts

- `npm run dev` — desarrollo
- `npm run build` — build de producción
- `npm run start` — servidor de producción
- `npm run lint` — ESLint

## Fase actual

Fase 0: setup inicial (Next.js, Tailwind, PWA básica, Supabase Auth con magic link, `/dashboard` protegido). Mapa, importación de lugares y optimizador pendientes.
