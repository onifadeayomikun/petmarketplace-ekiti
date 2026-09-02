-- ============================================================================
-- VetConnect Ekiti — PostgreSQL Schema
-- Online Veterinary Service Booking and Information System
-- Ekiti State, Nigeria
-- ----------------------------------------------------------------------------
-- Target: PostgreSQL 14+  (Supabase compatible)
-- Conventions:
--   * snake_case identifiers
--   * UUID primary keys (gen_random_uuid via pgcrypto)
--   * created_at / updated_at audit columns on mutable tables
--   * Foreign keys with explicit ON DELETE rules
--   * Indexes on every FK + common filter/sort columns
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;       -- gen_random_uuid()  (required)
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- trigram search on text (required)

-- cube + earthdistance are OPTIONAL: they only back a bonus GiST geo index.
-- The "nearby clinics" feature uses pure-trig Haversine SQL, so if a managed
-- host disallows these extensions, migration still succeeds.
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS cube;
  CREATE EXTENSION IF NOT EXISTS earthdistance;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping cube/earthdistance (not available): %', SQLERRM;
END $$;

-- ----------------------------------------------------------------------------
-- ENUM TYPES
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role        AS ENUM ('OWNER', 'CLINIC_ADMIN', 'SUPER_ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE clinic_status     AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vet_status        AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE animal_species    AS ENUM ('DOG','CAT','POULTRY','GOAT','SHEEP','CATTLE','RABBIT','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE animal_gender     AS ENUM ('MALE','FEMALE','UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM ('PENDING','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vaccination_status AS ENUM ('DUE','UPCOMING','COMPLETED','OVERDUE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE emergency_status  AS ENUM ('OPEN','ASSIGNED','RESOLVED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE urgency_level     AS ENUM ('LOW','MODERATE','HIGH','CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_status     AS ENUM ('PUBLISHED','PENDING','HIDDEN','FLAGGED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('EMAIL','SMS','WHATSAPP','IN_APP');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_status  AS ENUM ('QUEUED','SENT','FAILED','READ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- updated_at trigger helper
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. ROLES  (reference table; mirrors user_role enum for reporting / RBAC mgmt)
-- ============================================================================
CREATE TABLE IF NOT EXISTS roles (
  id          SMALLINT PRIMARY KEY,
  name        user_role NOT NULL UNIQUE,
  description TEXT
);

INSERT INTO roles (id, name, description) VALUES
  (1, 'OWNER',       'Animal owner / livestock farmer'),
  (2, 'CLINIC_ADMIN','Clinic administrator'),
  (3, 'SUPER_ADMIN', 'System administrator')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. USERS
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name       VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL UNIQUE,
  phone           VARCHAR(30),
  password_hash   VARCHAR(255) NOT NULL,
  role            user_role NOT NULL DEFAULT 'OWNER',
  avatar_url      TEXT,
  location        VARCHAR(120),          -- e.g. Ikerre, Ado-Ekiti, Igede
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  reset_token     VARCHAR(255),
  reset_token_expires TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role  ON users (role);
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. CLINICS
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id            UUID REFERENCES users(id) ON DELETE SET NULL, -- clinic_admin
  name                VARCHAR(180) NOT NULL,
  slug                VARCHAR(200) UNIQUE,
  description         TEXT,
  address             VARCHAR(255) NOT NULL,
  town                VARCHAR(120),          -- Ikerre / Ado-Ekiti / Igede / Ise / Emure / Ikole
  phone               VARCHAR(30),
  email               VARCHAR(255),
  operating_hours     JSONB DEFAULT '{}'::jsonb,    -- { mon:{open,close}, ... }
  services_offered    TEXT[] DEFAULT '{}',
  animal_types        animal_species[] DEFAULT '{}',
  emergency_available BOOLEAN NOT NULL DEFAULT FALSE,
  latitude            DOUBLE PRECISION,
  longitude           DOUBLE PRECISION,
  logo_url            TEXT,
  cover_url           TEXT,
  rating_avg          NUMERIC(2,1) NOT NULL DEFAULT 0.0,  -- denormalised
  rating_count        INTEGER NOT NULL DEFAULT 0,
  status              clinic_status NOT NULL DEFAULT 'PENDING',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clinics_owner    ON clinics (owner_id);
CREATE INDEX IF NOT EXISTS idx_clinics_status   ON clinics (status);
CREATE INDEX IF NOT EXISTS idx_clinics_town     ON clinics (town);
CREATE INDEX IF NOT EXISTS idx_clinics_emergency ON clinics (emergency_available);
CREATE INDEX IF NOT EXISTS idx_clinics_rating   ON clinics (rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_clinics_name_trgm ON clinics USING gin (name gin_trgm_ops);
-- Optional geo GiST index — only created if earthdistance is present.
DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS idx_clinics_geo ON clinics USING gist (ll_to_earth(latitude, longitude));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Skipping geo GiST index (earthdistance unavailable): %', SQLERRM;
END $$;
DROP TRIGGER IF EXISTS trg_clinics_updated ON clinics;
CREATE TRIGGER trg_clinics_updated BEFORE UPDATE ON clinics
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 4. VETERINARIANS
-- ============================================================================
CREATE TABLE IF NOT EXISTS veterinarians (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  full_name       VARCHAR(150) NOT NULL,
  license_number  VARCHAR(80),
  specialization  VARCHAR(150),
  bio             TEXT,
  photo_url       TEXT,
  status          vet_status NOT NULL DEFAULT 'PENDING',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vets_clinic ON veterinarians (clinic_id);
CREATE INDEX IF NOT EXISTS idx_vets_status ON veterinarians (status);
DROP TRIGGER IF EXISTS trg_vets_updated ON veterinarians;
CREATE TRIGGER trg_vets_updated BEFORE UPDATE ON veterinarians
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 5. ANIMALS
-- ============================================================================
CREATE TABLE IF NOT EXISTS animals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               VARCHAR(120) NOT NULL,
  species            animal_species NOT NULL,
  breed              VARCHAR(120),
  gender             animal_gender NOT NULL DEFAULT 'UNKNOWN',
  date_of_birth      DATE,
  age_years          NUMERIC(4,1),       -- denormalised convenience
  weight_kg          NUMERIC(6,2),
  color              VARCHAR(80),
  vaccination_status VARCHAR(40) DEFAULT 'UNKNOWN',
  medical_notes      TEXT,
  photo_url          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_animals_owner   ON animals (owner_id);
CREATE INDEX IF NOT EXISTS idx_animals_species ON animals (species);
DROP TRIGGER IF EXISTS trg_animals_updated ON animals;
CREATE TRIGGER trg_animals_updated BEFORE UPDATE ON animals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 6. CLINIC AVAILABILITY  (recurring rules + one-off blocks)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clinic_availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id     UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  day_of_week   SMALLINT,            -- 0=Sun .. 6=Sat (NULL for date-specific rows)
  open_time     TIME,
  close_time    TIME,
  break_start   TIME,
  break_end     TIME,
  slot_minutes  SMALLINT NOT NULL DEFAULT 30,
  specific_date DATE,                -- for holidays / blocked / emergency closure
  is_blocked    BOOLEAN NOT NULL DEFAULT FALSE,
  reason        VARCHAR(160),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_avail_clinic ON clinic_availability (clinic_id);
CREATE INDEX IF NOT EXISTS idx_avail_dow    ON clinic_availability (clinic_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_avail_date   ON clinic_availability (clinic_id, specific_date);
DROP TRIGGER IF EXISTS trg_avail_updated ON clinic_availability;
CREATE TRIGGER trg_avail_updated BEFORE UPDATE ON clinic_availability
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. APPOINTMENT SLOTS  (generated bookable slots — enforces no double booking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointment_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id   UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  vet_id      UUID REFERENCES veterinarians(id) ON DELETE SET NULL,
  slot_date   DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  is_booked   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- a clinic/vet cannot have two slots at the same datetime
  CONSTRAINT uq_slot UNIQUE (clinic_id, vet_id, slot_date, start_time)
);
CREATE INDEX IF NOT EXISTS idx_slots_clinic_date ON appointment_slots (clinic_id, slot_date);
CREATE INDEX IF NOT EXISTS idx_slots_open        ON appointment_slots (clinic_id, slot_date, is_booked);

-- ============================================================================
-- 8. APPOINTMENTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS appointments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  animal_id      UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vet_id         UUID REFERENCES veterinarians(id) ON DELETE SET NULL,
  slot_id        UUID UNIQUE REFERENCES appointment_slots(id) ON DELETE SET NULL,
  service        VARCHAR(160) NOT NULL,
  scheduled_date DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME,
  status         appointment_status NOT NULL DEFAULT 'PENDING',
  notes          TEXT,
  reject_reason  VARCHAR(255),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appt_clinic ON appointments (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appt_owner  ON appointments (owner_id);
CREATE INDEX IF NOT EXISTS idx_appt_animal ON appointments (animal_id);
CREATE INDEX IF NOT EXISTS idx_appt_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appt_date   ON appointments (scheduled_date);
DROP TRIGGER IF EXISTS trg_appt_updated ON appointments;
CREATE TRIGGER trg_appt_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 9. REVIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id      UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  rating         SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body           TEXT,
  images         TEXT[] DEFAULT '{}',
  status         review_status NOT NULL DEFAULT 'PUBLISHED',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- one review per completed appointment
  CONSTRAINT uq_review_per_appt UNIQUE (appointment_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_clinic ON reviews (clinic_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user   ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews (status);
DROP TRIGGER IF EXISTS trg_reviews_updated ON reviews;
CREATE TRIGGER trg_reviews_updated BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 10. REVIEW RESPONSES  (clinic admin replies)
-- ============================================================================
CREATE TABLE IF NOT EXISTS review_responses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  responder_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_resp_review ON review_responses (review_id);
DROP TRIGGER IF EXISTS trg_review_resp_updated ON review_responses;
CREATE TRIGGER trg_review_resp_updated BEFORE UPDATE ON review_responses
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 11. CATEGORIES  (article taxonomy)
-- ============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL UNIQUE,
  slug        VARCHAR(140) NOT NULL UNIQUE,
  species     animal_species,             -- optional species association
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_categories_species ON categories (species);

-- ============================================================================
-- 12. ARTICLES  (veterinary information portal)
-- ============================================================================
CREATE TABLE IF NOT EXISTS articles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID REFERENCES categories(id) ON DELETE SET NULL,
  author_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  title         VARCHAR(220) NOT NULL,
  slug          VARCHAR(240) NOT NULL UNIQUE,
  excerpt       VARCHAR(400),
  body          TEXT NOT NULL,
  cover_url     TEXT,
  tags          TEXT[] DEFAULT '{}',
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles (category_id);
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles (is_published);
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_articles_tags ON articles USING gin (tags);
DROP TRIGGER IF EXISTS trg_articles_updated ON articles;
CREATE TRIGGER trg_articles_updated BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 13. VACCINATIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS vaccinations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id     UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  vaccine_name  VARCHAR(160) NOT NULL,
  due_date      DATE NOT NULL,
  reminder_date DATE,
  administered_date DATE,
  status        vaccination_status NOT NULL DEFAULT 'UPCOMING',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vax_animal ON vaccinations (animal_id);
CREATE INDEX IF NOT EXISTS idx_vax_due    ON vaccinations (due_date);
CREATE INDEX IF NOT EXISTS idx_vax_status ON vaccinations (status);
DROP TRIGGER IF EXISTS trg_vax_updated ON vaccinations;
CREATE TRIGGER trg_vax_updated BEFORE UPDATE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 14. EMERGENCY REQUESTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS emergency_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_clinic_id UUID REFERENCES clinics(id) ON DELETE SET NULL,
  animal_type     animal_species NOT NULL,
  symptoms        TEXT NOT NULL,
  location_text   VARCHAR(200),
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  phone           VARCHAR(30) NOT NULL,
  urgency         urgency_level NOT NULL DEFAULT 'HIGH',
  status          emergency_status NOT NULL DEFAULT 'OPEN',
  resolved_note   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_emerg_status ON emergency_requests (status);
CREATE INDEX IF NOT EXISTS idx_emerg_clinic ON emergency_requests (assigned_clinic_id);
CREATE INDEX IF NOT EXISTS idx_emerg_user   ON emergency_requests (user_id);
DROP TRIGGER IF EXISTS trg_emerg_updated ON emergency_requests;
CREATE TRIGGER trg_emerg_updated BEFORE UPDATE ON emergency_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 15. NOTIFICATIONS  (log table; channel-agnostic)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  channel     notification_channel NOT NULL DEFAULT 'EMAIL',
  subject     VARCHAR(200),
  body        TEXT,
  payload     JSONB DEFAULT '{}'::jsonb,
  status      notification_status NOT NULL DEFAULT 'QUEUED',
  error       TEXT,
  sent_at     TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notif_status ON notifications (status);

-- ============================================================================
-- 16. ANALYTICS  (daily rollup snapshots for dashboards)
-- ============================================================================
CREATE TABLE IF NOT EXISTS analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       UUID REFERENCES clinics(id) ON DELETE CASCADE, -- NULL = platform-wide
  snapshot_date   DATE NOT NULL,
  total_users        INTEGER DEFAULT 0,
  total_clinics      INTEGER DEFAULT 0,
  total_appointments INTEGER DEFAULT 0,
  appointments_today INTEGER DEFAULT 0,
  total_patients     INTEGER DEFAULT 0,
  emergency_count    INTEGER DEFAULT 0,
  avg_rating         NUMERIC(2,1) DEFAULT 0.0,
  metrics            JSONB DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_analytics UNIQUE (clinic_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS idx_analytics_clinic ON analytics (clinic_id);
CREATE INDEX IF NOT EXISTS idx_analytics_date   ON analytics (snapshot_date);

-- ============================================================================
-- DENORMALISED RATING MAINTENANCE
-- Keep clinics.rating_avg / rating_count in sync with published reviews.
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_clinic_rating(p_clinic UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE clinics c SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric,1)
                           FROM reviews r
                           WHERE r.clinic_id = p_clinic AND r.status = 'PUBLISHED'), 0.0),
    rating_count = (SELECT COUNT(*) FROM reviews r
                    WHERE r.clinic_id = p_clinic AND r.status = 'PUBLISHED')
  WHERE c.id = p_clinic;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_review_rating()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_clinic_rating(COALESCE(NEW.clinic_id, OLD.clinic_id));
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_reviews_rating ON reviews;
CREATE TRIGGER trg_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW EXECUTE FUNCTION trg_review_rating();

-- ============================================================================
-- END SCHEMA
-- ============================================================================
