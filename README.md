# VetConnect Ekiti

> Online Veterinary Service Booking & Information System for Ekiti State, Nigeria.

VetConnect Ekiti is a full-stack web application that connects animal owners and
livestock farmers in **Ikerre-Ekiti, Ado-Ekiti, Igede, Ise, Emure, Ikole** and
surrounding communities in Ekiti State with the veterinary clinics that
serve them. Today, finding a vet across these communities is often a
word-of-mouth exercise: there is no central directory, no way to book ahead, no
reliable preventive-care information, and no fast path to help in an emergency.
VetConnect solves this with a single platform that provides a **centralised,
searchable clinic directory**, **online appointment scheduling** with
double-booking prevention, a **preventive-care information portal**, **vaccination
reminders**, and an **emergency assistance** workflow that matches an animal in
distress to the nearest emergency-capable clinic. The interface is **mobile-first**
because the target users are overwhelmingly smartphone-primary.

---

## Table of Contents

- [Features by Role](#features-by-role)
- [Core Modules](#core-modules)
- [Tech Stack](#tech-stack)
- [Monorepo Structure](#monorepo-structure)
- [Local Setup](#local-setup)
- [npm Scripts](#npm-scripts)
- [Documentation](#documentation)
- [Security & Performance Highlights](#security--performance-highlights)

---

## Features by Role

The platform recognises **four actors**. The first is unauthenticated; the other
three map to the `user_role` enum (`OWNER`, `CLINIC_ADMIN`, `SUPER_ADMIN`).

### 1. Guest (unauthenticated)
- Browse and search the public clinic **directory** (filter by town, service, animal
  type, emergency availability, rating).
- View a clinic profile, its veterinarians, services, operating hours, map location
  and published reviews.
- Find clinics **near me** via geolocation (Leaflet/OSM map + Haversine distance).
- Read the **information portal** (preventive-care articles by category).
- Submit an **emergency assistance** request and view the emergency contacts list.
- Register / log in.

### 2. Animal Owner (`OWNER`)
- Maintain a profile and a roster of **animals / livestock** (pet & farm species).
- **Book appointments** at approved clinics against real, computed time slots.
- Manage appointments: cancel and reschedule.
- Track **vaccinations** with due/upcoming/overdue status and reminder dates.
- Leave a **review** for a completed appointment (one per appointment).
- View an owner **analytics** summary and in-app **notifications**.

### 3. Clinic Administrator (`CLINIC_ADMIN`)
- Register and manage a **clinic profile** (services, animal types, hours, location,
  emergency flag, media).
- Manage **veterinarians** on staff.
- Define recurring weekly **availability** and one-off date **blocks** (holidays,
  closures) that drive slot generation.
- Action incoming appointments: **confirm, reject, complete, mark no-show, reschedule**.
- **Respond** to reviews; triage assigned **emergency** requests.
- View clinic **analytics**.

### 4. System Administrator (`SUPER_ADMIN`)
- **Approve / reject / suspend** clinics and **verify** veterinarians.
- Manage **users** (list, view, activate/deactivate, delete).
- **Moderate** reviews (publish / hide / flag).
- Author and manage **articles** and **categories** in the information portal.
- Oversee all **emergency** requests and platform-wide **analytics**.

---

## Core Modules

The backend is organised into **12 feature modules** plus supporting modules,
each exposed under `/api`:

| # | Module | Responsibility |
|---|--------|----------------|
| 1 | **Auth** | Registration, login, logout, password reset, session (`/me`) |
| 2 | **Users** | User administration & self-profile |
| 3 | **Clinics** | Clinic directory, profiles, lifecycle (approval) |
| 4 | **Veterinarians** | Clinic staff & license verification |
| 5 | **Geo** | "Near me" search (Haversine over lat/lng) |
| 6 | **Animals** | Owner's pet & livestock records |
| 7 | **Availability** | Weekly schedules, blocks, bookable slot computation |
| 8 | **Appointments** | Booking + appointment state machine |
| 9 | **Vaccinations** | Vaccination tracking, reminders, suggestions |
| 10 | **Reviews** | Ratings, responses, moderation |
| 11 | **Emergency** | Emergency assistance requests & contacts |
| 12 | **Articles** | Preventive-care information portal & categories |
| + | **Notifications** | In-app/email notification log |
| + | **Analytics** | Role-specific dashboard rollups |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3, React Router 6 (lazy routes), TanStack Query 5, Zustand, React Hook Form + Zod, Framer Motion, Leaflet / React-Leaflet (OpenStreetMap tiles), Axios, `vite-plugin-pwa` |
| **Backend** | Node.js (ESM, Node 18+), Express 4, `pg` (node-postgres pool), JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Zod validation, Helmet, CORS, `express-rate-limit`, Morgan, Nodemailer, `slugify` |
| **Database** | PostgreSQL 14+ (Supabase-compatible) — UUID PKs, enums, triggers; extensions `pgcrypto`, `pg_trgm`, `cube`, `earthdistance` |
| **Deployment targets** | Frontend → **Vercel**; Backend → **Render** or **Railway**; Database → **Supabase PostgreSQL** |

---

## Monorepo Structure

```
vetconnect-ekiti/
├── README.md                 # this file
├── docs/                     # architecture, ERD, API, deployment guides
│   ├── ARCHITECTURE.md
│   ├── ERD.md
│   ├── API.md
│   └── DEPLOYMENT.md
├── backend/                  # Node/Express REST API
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── server.js         # boot + graceful shutdown
│       ├── app.js            # Express app wiring (helmet, cors, rate-limit)
│       ├── config/           # env loading
│       ├── db/
│       │   ├── pool.js       # pg Pool + query/withTransaction helpers
│       │   ├── schema.sql    # 16 tables, enums, triggers, indexes
│       │   ├── migrate.js    # applies schema.sql
│       │   └── seed.js       # demo data + demo logins
│       ├── middleware/       # auth/RBAC, validate (zod), rateLimit, error
│       ├── routes/index.js   # central API router (mount points)
│       ├── utils/            # ApiError, mailer, response helpers
│       └── modules/<name>/   # routes · controller · service · validation
└── frontend/                 # React + Vite SPA / PWA
    ├── package.json
    ├── .env.example
    └── src/
        ├── App.tsx           # route map (public / owner / clinic / admin)
        ├── pages/            # public, auth, owner, clinic, admin pages
        ├── components/       # layout + design-system UI
        ├── router/           # ProtectedRoute (RBAC guard)
        ├── store/            # zustand auth store
        └── lib/              # axios client, react-query hooks
```

Each backend feature module follows the same shape:

```
modules/<name>/
├── <name>.routes.js       # Express router (mount + middleware)
├── <name>.controller.js   # HTTP layer (req/res)
├── <name>.service.js      # business logic + SQL
└── <name>.validation.js   # Zod request schemas
```

---

## Local Setup

### Prerequisites
- **Node.js 18+** and npm
- **PostgreSQL 14+** locally, or a free **Supabase** project (recommended — it ships
  with the required extensions)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and a long random JWT_SECRET.
# For Supabase/Railway/Render also set PGSSL=true.

npm install
npm run migrate    # applies src/db/schema.sql (tables, enums, triggers)
npm run seed       # loads demo clinics, users, articles, etc.
npm run dev        # starts API on http://localhost:5000 (nodemon)
```

Health check: <http://localhost:5000/api/health>

> **Demo login credentials.** After `npm run seed`, the seed script prints the demo
> accounts to the console. They follow the pattern below (password is shared for
> convenience in dev):
>
> | Role | Email | Password |
> |------|-------|----------|
> | System Admin | `admin@vetconnect.ng` | `Password123` |
> | Clinic Admin | `clinic@vetconnect.ng` | `Password123` |
> | Animal Owner | `owner@vetconnect.ng` | `Password123` |
>
> Always check the actual seed console output for the authoritative list, and never
> use these credentials outside local development.

### 2. Frontend

```bash
cd frontend
cp .env.example .env
# VITE_API_URL should point at the backend, e.g. http://localhost:5000/api

npm install
npm run dev        # starts Vite dev server on http://localhost:5173
```

---

## npm Scripts

### `backend/`
| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `nodemon src/server.js` | Run API with hot reload |
| `npm start` | `node src/server.js` | Run API (production) |
| `npm run migrate` | `node src/db/migrate.js` | Apply `schema.sql` |
| `npm run seed` | `node src/db/seed.js` | Seed demo data + logins |
| `npm run db:reset` | migrate + seed | Rebuild the database |
| `npm test` | Jest (ESM) | Run tests |
| `npm run test:watch` | Jest watch | Tests in watch mode |
| `npm run lint` | `eslint src` | Lint backend |

### `frontend/`
| Script | Command | Purpose |
|--------|---------|---------|
| `npm run dev` | `vite` | Dev server |
| `npm run build` | `tsc -b && vite build` | Type-check + production build to `dist/` |
| `npm run preview` | `vite preview` | Preview the production build |
| `npm run lint` | `eslint . --ext ts,tsx` | Lint frontend |

---

## Documentation

| Document | Contents |
|----------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, layered backend, request lifecycle, RBAC matrix, notification strategy |
| [docs/ERD.md](docs/ERD.md) | Entity-relationship diagram and per-table reference for all 16 tables |
| [docs/API.md](docs/API.md) | Full REST API reference with auth, envelopes, pagination and curl examples |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment (Supabase + Render/Railway + Vercel) |

---

## Security & Performance Highlights

**Security**
- **JWT bearer auth** with bcrypt-hashed passwords (`BCRYPT_ROUNDS`, default 12).
- **Role-based access control** (`authenticate` + `authorize(...roles)`); `SUPER_ADMIN`
  can never be self-registered.
- **Zod validation** on every request body, query and route param.
- **Helmet** security headers and **CORS** locked to the configured `CLIENT_URL`(s).
- **Rate limiting** globally on `/api` and a stricter limiter on auth endpoints.
- 1 MB JSON/body cap to mitigate oversized-payload DoS; `trust proxy` for correct
  client IPs behind Render/Railway/Vercel.
- Atomic **double-booking prevention** via a transactional slot reservation guarded
  by a unique constraint.

**Performance**
- **Lazy-loaded** React routes keep the initial mobile bundle small; **PWA** caching.
- **TanStack Query** client-side caching and request de-duplication.
- Indexed FKs and common filter/sort columns; **trigram (GIN)** indexes for text
  search; **GiST `earthdistance`** index for geo queries.
- **Denormalised** clinic ratings maintained by a database trigger (no N+1 averaging).
- Connection **pooling** via `pg.Pool`.
</content>
</invoke>
