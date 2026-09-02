# Production Deployment Guide — VetConnect Ekiti

Reference topology:

```
Vercel (frontend SPA/PWA)  ──HTTPS──▶  Render or Railway (Express API)  ──▶  Supabase PostgreSQL
```

Deploy in this order: **1) Database → 2) Backend → 3) Frontend**, then wire CORS and
run the smoke tests.

---

## 1. Database — Supabase PostgreSQL

1. **Create a project** at <https://supabase.com>. Choose a region close to Nigeria
   (e.g. EU/London) and set a strong database password.

2. **Get the connection string.** In *Project Settings → Database → Connection string*,
   copy the URI. It looks like:
   ```
   postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres
   ```
   For serverless/proxied hosts you may prefer the **connection pooler** string (port
   `6543`). Either works with `pg`.

3. **Enable required extensions.** The schema needs `pgcrypto`, `pg_trgm`, `cube`, and
   `earthdistance`. `schema.sql` runs `CREATE EXTENSION IF NOT EXISTS ...` for each, so
   migration creates them automatically. All four are supported on Supabase. If your
   role lacks create-extension rights, enable them once in the dashboard
   (*Database → Extensions*) — search for `pgcrypto`, `pg_trgm`, `cube`, `earthdistance`.

4. **Run schema + seed.** From a machine with the repo (locally or a one-off job),
   point the backend at the Supabase URL and migrate:
   ```bash
   cd backend
   export DATABASE_URL="postgresql://postgres:<PASSWORD>@db.<ref>.supabase.co:5432/postgres"
   export PGSSL=true
   npm install
   npm run migrate     # applies src/db/schema.sql (tables, enums, triggers, indexes)
   npm run seed        # demo data (optional in production)
   ```
   `PGSSL=true` is required for Supabase/Railway/Render TLS connections.

---

## 2. Backend — Express API

The backend runs the same way on Render and Railway.

| Setting | Value |
|---------|-------|
| Root directory | `backend` |
| Build command | `npm install` |
| Start command | `npm start` (`node src/server.js`) |
| Health check path | `/api/health` |
| Node version | 18+ (set via `engines` / platform setting) |

### Required environment variables

From `backend/.env.example`:

| Variable | Notes |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | Provided by the platform; the app reads `process.env.PORT` |
| `CLIENT_URL` | **Your Vercel domain** (comma-separate multiple origins) — drives CORS |
| `DATABASE_URL` | Supabase connection string |
| `PGSSL` | **`true`** in production (Supabase/Render/Railway) |
| `JWT_SECRET` | Long random string |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `JWT_RESET_EXPIRES_IN` | e.g. `1h` |
| `BCRYPT_ROUNDS` | e.g. `12` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | Email transport (e.g. `smtp.gmail.com` / `587` / `false`) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (use an app password) |
| `MAIL_FROM` | e.g. `VetConnect Ekiti <no-reply@vetconnect.ng>` |
| `GOOGLE_MAPS_API_KEY` | Optional; Leaflet/OSM needs none |
| `RATE_LIMIT_WINDOW_MS` | e.g. `900000` |
| `RATE_LIMIT_MAX` | e.g. `300` |

> Do **not** commit `.env`. Set these in the platform's environment/secrets UI.

### Render

1. New → **Web Service**, connect the repo.
2. **Root Directory:** `backend`. **Build Command:** `npm install`.
   **Start Command:** `npm start`.
3. Add the environment variables above (`PGSSL=true`).
4. **Health Check Path:** `/api/health`.
5. Deploy. Note the public URL (e.g. `https://vetconnect-api.onrender.com`).

### Railway

1. New Project → **Deploy from GitHub repo**.
2. In the service settings set **Root Directory** to `backend`.
3. **Build:** `npm install`. **Start:** `npm start`.
4. Add the environment variables (`PGSSL=true`); Railway injects `PORT` automatically.
5. Generate a public domain and (optionally) add a health check on `/api/health`.

You can use Supabase as the database for either host, or Railway's own PostgreSQL plugin
(remember to keep `PGSSL=true` and enable the four extensions).

---

## 3. Frontend — Vercel

| Setting | Value |
|---------|-------|
| Framework preset | **Vite** |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Install command | `npm install` |

### Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://<your-api-host>/api` (the deployed backend) |
| `VITE_MAP_TILE_URL` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |

> Vite inlines `VITE_*` variables **at build time** — set them before/redeploy after
> changing the API URL.

### SPA rewrite (`vercel.json`)

Because this is a client-side-routed SPA, deep links (e.g. `/clinics/some-slug`,
`/app/dashboard`) must fall back to `index.html`. Add `frontend/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 4. CORS

The backend allows only origins listed in `CLIENT_URL` (comma-separated). After the
frontend is live on Vercel, set the backend's `CLIENT_URL` to that exact domain, e.g.:

```
CLIENT_URL=https://vetconnect-ekiti.vercel.app
```

Then redeploy/restart the backend so the new origin is honoured. (In non-production the
app is permissive; in production a mismatched origin is rejected.)

---

## 5. Post-Deploy Checklist & Smoke Tests

**Checklist**
- [ ] Supabase reachable; `pgcrypto`, `pg_trgm`, `cube`, `earthdistance` enabled.
- [ ] `npm run migrate` applied (16 tables, enums, triggers present).
- [ ] Backend env vars set, including `PGSSL=true` and a strong `JWT_SECRET`.
- [ ] Backend health check green at `/api/health`.
- [ ] Frontend `VITE_API_URL` points at the deployed API; `vercel.json` rewrite present.
- [ ] Backend `CLIENT_URL` set to the Vercel domain (CORS).
- [ ] SMTP credentials valid (test a password-reset or booking email).

**Smoke tests**

```bash
API="https://<your-api-host>/api"

# 1. Health
curl "$API/health"
# → { "success": true, "status": "ok", ... }

# 2. Public directory loads
curl "$API/clinics?limit=5"

# 3. Auth round-trip
curl -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{ "email": "admin@vetconnect.ng", "password": "Password123" }'
# → token; then:
curl "$API/auth/me" -H "Authorization: Bearer <token>"

# 4. Geo search
curl "$API/geo/nearby?lat=6.66&lng=3.43&radius=15"
```

In the browser:
- [ ] Load the Vercel URL; the home page and directory render.
- [ ] Open a deep link directly (e.g. `/directory`) — it loads (rewrite works), no 404.
- [ ] No CORS errors in the console on authenticated requests.
- [ ] Map tiles render on the directory / emergency pages.
- [ ] Log in as each role and confirm the correct dashboard appears.
</content>
