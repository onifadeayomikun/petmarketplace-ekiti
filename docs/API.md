# REST API Reference — VetConnect Ekiti

All endpoints derived directly from `backend/src/routes/index.js` and each module's
`*.routes.js`. Routes are accurate to the codebase.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:5000/api` |
| Production | `https://<your-api-host>/api` |

The frontend reads the base URL from `VITE_API_URL`.

## Authentication

Protected endpoints require a **Bearer JWT** obtained from `POST /auth/login` or
`POST /auth/register`:

```
Authorization: Bearer <token>
```

- `authenticate` — token required (401 if missing/invalid).
- `optionalAuth` — works for guests; if a valid token is present the user is attached.
- `authorize(...roles)` — role gate (403 if the user's role is not allowed).

Roles: `OWNER`, `CLINIC_ADMIN`, `SUPER_ADMIN`. `SUPER_ADMIN` cannot be self-registered.

## Response Envelope

**Success**
```json
{ "success": true, "data": { /* resource or array */ }, "meta": { /* optional */ } }
```

**Paginated list** — `meta` carries pagination:
```json
{
  "success": true,
  "data": [ /* items */ ],
  "meta": { "page": 1, "limit": 20, "total": 134, "totalPages": 7 }
}
```

**Error**
```json
{ "success": false, "error": { "message": "Human-readable message", "details": [ /* zod issues, optional */ ] } }
```

Common status codes: `400` validation/bad request, `401` unauthenticated,
`403` forbidden (role/ownership), `404` not found, `409` conflict (e.g. slot taken),
`429` rate limited, `500` server error.

## Pagination & Filtering

List endpoints accept `page` (default 1) and `limit` (default 20, max 100) as query
params, plus endpoint-specific filters documented below.

## Health

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/health` | none | `{ success, service, status: "ok", time }` |

---

## Auth — `/auth`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| POST | `/auth/register` | none (rate-limited) | `full_name, email, password(min8), phone?, role?(OWNER\|CLINIC_ADMIN), location?` | Creates account, returns token + user |
| POST | `/auth/login` | none (rate-limited) | `email, password` | Returns token + user |
| POST | `/auth/logout` | none | — | Client discards token |
| POST | `/auth/forgot-password` | none (rate-limited) | `email` | Issues reset token (email) |
| POST | `/auth/reset-password` | none (rate-limited) | `token, password(min8)` | Sets new password |
| GET | `/auth/me` | authenticate | — | Current user |

## Users — `/users`  (all require auth)

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/users` | SUPER_ADMIN | query: pagination + filters | List users |
| PUT | `/users/me` | any authenticated | profile fields | Update own profile |
| GET | `/users/:id` | any authenticated | `:id` UUID | Get a user |
| PATCH | `/users/:id/status` | SUPER_ADMIN | `:id`, body status fields | Activate/deactivate |
| DELETE | `/users/:id` | SUPER_ADMIN | `:id` | Delete user |

## Clinics — `/clinics`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/clinics` | optionalAuth | query: `page,limit,search,town,service,animal_type,emergency,minRating,sort(rating\|reviews\|newest),status` | Directory listing |
| GET | `/clinics/mine` | CLINIC_ADMIN | — | Caller's own clinic(s) |
| POST | `/clinics` | OWNER, CLINIC_ADMIN | `name, address, town?, phone?, email?, operating_hours?, services_offered?, animal_types?, emergency_available?, latitude?, longitude?, logo_url?, cover_url?, description?` | Create clinic (starts `PENDING`) |
| GET | `/clinics/:idOrSlug` | optionalAuth | `:idOrSlug` | Clinic profile by id or slug |
| PUT | `/clinics/:id` | OWNER, CLINIC_ADMIN, SUPER_ADMIN | `:id`, partial clinic fields | Update (ownership enforced) |
| PATCH | `/clinics/:id/status` | SUPER_ADMIN | `:id`, `status(PENDING\|APPROVED\|REJECTED\|SUSPENDED)` | Approve/reject/suspend |

## Veterinarians — `/veterinarians`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/veterinarians` | none | query: list filters (e.g. `clinic_id`, status, pagination) | List vets |
| POST | `/veterinarians` | CLINIC_ADMIN | `clinic_id, full_name, license_number?, specialization?, bio?, photo_url?` | Add vet to clinic |
| PUT | `/veterinarians/:id` | CLINIC_ADMIN, SUPER_ADMIN | `:id`, vet fields | Update vet |
| PATCH | `/veterinarians/:id/verify` | SUPER_ADMIN | `:id`, verify body (status) | Verify/reject license |
| DELETE | `/veterinarians/:id` | CLINIC_ADMIN, SUPER_ADMIN | `:id` | Remove vet |

## Geo — `/geo`

| Method | Path | Auth | Query | Notes |
|--------|------|------|-------|-------|
| GET | `/geo/nearby` | none | `lat, lng, radius?(km, default 15, max 500), emergency?, limit?(default 20, max 100)` | Clinics near a point, by Haversine distance |

## Animals — `/animals`  (all require auth; OWNER scope)

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/animals` | authenticate | query: list filters | Caller's animals |
| GET | `/animals/:id` | authenticate | `:id` | Get one (ownership checked) |
| POST | `/animals` | authenticate | `name, species, breed?, gender?, date_of_birth?, weight_kg?, color?, medical_notes?, photo_url?` | Create animal |
| PUT | `/animals/:id` | authenticate | `:id`, animal fields | Update |
| DELETE | `/animals/:id` | authenticate | `:id` | Delete |

## Availability — `/availability`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/availability` | none | query: `clinic_id` | List a clinic's schedule rules |
| GET | `/availability/:clinic_id/slots` | none | `:clinic_id`, query `date(YYYY-MM-DD)` | **Computed bookable slots** for a day (each with `available`) |
| PUT | `/availability/:clinic_id` | authenticate | `:clinic_id`, `{ schedule: [ { day_of_week(0-6), open_time, close_time, break_start?, break_end?, slot_minutes(5-480, default 30) } ] }` | Replace weekly schedule |
| POST | `/availability/:clinic_id/block` | authenticate | `:clinic_id`, `{ specific_date, is_blocked(default true), reason? }` | Add a date block/closure |
| DELETE | `/availability/block/:id` | authenticate | `:id` | Remove a block |

## Appointments — `/appointments`  (all require auth)

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| POST | `/appointments` | authenticate (OWNER) | `clinic_id, animal_id, service, scheduled_date, start_time, vet_id?, notes?` | Book; transactional slot reservation prevents double-booking (`409` if taken) |
| GET | `/appointments` | authenticate | query: `page,limit,status,date,clinic_id` | Role-scoped list (owner → own; clinic admin → their clinic's; admin → all) |
| GET | `/appointments/:id` | authenticate | `:id` | One (participants only) |
| PATCH | `/appointments/:id` | authenticate | `:id`, `{ action: cancel\|reschedule\|confirm\|reject\|complete\|no_show, scheduled_date?, start_time?, reject_reason? }` | State transition. Owner: cancel/reschedule. Clinic/admin: confirm/reject/complete/no_show/reschedule. Reschedule requires `scheduled_date`+`start_time` |

## Vaccinations — `/vaccinations`  (all require auth)

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/vaccinations/suggestions` | authenticate | query: suggestion params (e.g. species) | Suggested vaccine schedule |
| GET | `/vaccinations` | authenticate | query: list filters | List vaccination records |
| POST | `/vaccinations` | authenticate | `animal_id, vaccine_name, due_date, reminder_date?, notes?` | Create record |
| PUT | `/vaccinations/:id` | authenticate | `:id`, fields (`administered_date`, `status`, …) | Update |
| DELETE | `/vaccinations/:id` | authenticate | `:id` | Delete |

## Reviews — `/reviews`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/reviews` | none | query: list filters (e.g. `clinic_id`, `status`, pagination) | Public clinic reviews; `?status=` serves the SUPER_ADMIN moderation queue |
| POST | `/reviews` | OWNER | `clinic_id, appointment_id, rating(1-5), body?, images?` | One review per completed appointment |
| POST | `/reviews/:id/response` | CLINIC_ADMIN, SUPER_ADMIN | `:id`, `{ body }` | Clinic reply (own clinic) |
| PATCH | `/reviews/:id/moderate` | SUPER_ADMIN | `:id`, moderation body (status) | Publish/hide/flag |
| DELETE | `/reviews/:id` | authenticate | `:id` | Author (within edit window) or SUPER_ADMIN |

## Emergency — `/emergency`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| POST | `/emergency` | optionalAuth (guests allowed) | `animal_type, symptoms, phone, location_text?, latitude?, longitude?, urgency?` | Raise an emergency request |
| GET | `/emergency/contacts` | none | — | Public quick-reference list of emergency clinics |
| GET | `/emergency` | CLINIC_ADMIN, SUPER_ADMIN | query: `status`, pagination | Triage queue |
| GET | `/emergency/:id` | authenticate | `:id` | One request |
| PATCH | `/emergency/:id` | CLINIC_ADMIN, SUPER_ADMIN | `:id`, `{ status, assigned_clinic_id?, resolved_note? }` | Assign/resolve |

## Articles — `/articles`

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/articles/categories` | none | — | List categories |
| POST | `/articles/categories` | SUPER_ADMIN | `{ name, slug?, species?, description? }` | Create category |
| GET | `/articles` | none | query: list filters (category, tag, search, pagination) | Published articles |
| POST | `/articles` | SUPER_ADMIN | `{ title, body, category_id?, excerpt?, cover_url?, tags?, is_published? }` | Create article |
| PUT | `/articles/:id` | SUPER_ADMIN | `:id`, article fields | Update |
| DELETE | `/articles/:id` | SUPER_ADMIN | `:id` | Delete |
| GET | `/articles/:slug` | none | `:slug` | Article by slug |

## Notifications — `/notifications`  (all require auth)

| Method | Path | Auth | Body / Params | Notes |
|--------|------|------|---------------|-------|
| GET | `/notifications` | authenticate | query: list filters, pagination | Caller's notifications |
| GET | `/notifications/unread-count` | authenticate | — | `{ count }` |
| PATCH | `/notifications/read-all` | authenticate | — | Mark all read |
| PATCH | `/notifications/:id/read` | authenticate | `:id` | Mark one read |

## Analytics — `/analytics`  (all require auth)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/analytics/owner` | OWNER | Owner dashboard rollup |
| GET | `/analytics/clinic` | CLINIC_ADMIN | Clinic dashboard rollup |
| GET | `/analytics/admin` | SUPER_ADMIN | Platform-wide rollup |

---

## Example Requests

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "Ada Okeke",
    "email": "ada@example.com",
    "password": "Password123",
    "role": "OWNER",
    "location": "Ikerre"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "email": "owner@vetconnect.ng", "password": "Password123" }'
# → { "success": true, "data": { "token": "<JWT>", "user": { ... } } }
```

### List clinics (filtered)
```bash
curl "http://localhost:5000/api/clinics?town=Ikerre&emergency=true&sort=rating&page=1&limit=20"
```

### Book an appointment
```bash
TOKEN="<paste JWT here>"
curl -X POST http://localhost:5000/api/appointments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": "00000000-0000-0000-0000-000000000000",
    "animal_id": "11111111-1111-1111-1111-111111111111",
    "service": "Routine checkup",
    "scheduled_date": "2026-07-01",
    "start_time": "10:30"
  }'
# 201 on success; 409 { "error": { "message": "Slot no longer available" } } if taken.
```
</content>
