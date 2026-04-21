-- ─────────────────────────────────────────────
-- Suspectra 2.0  —  V1 Initial Schema
-- Database: PostgreSQL 16
-- ─────────────────────────────────────────────

-- Users
CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) UNIQUE NOT NULL,
    name        VARCHAR(255) NOT NULL,
    role        VARCHAR(50)  NOT NULL DEFAULT 'INVESTIGATOR',
    is_active   BOOLEAN      NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- OTP Codes
CREATE TABLE IF NOT EXISTS otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL,
    code        VARCHAR(6)   NOT NULL,
    expires_at  TIMESTAMPTZ  NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Cases
CREATE TABLE IF NOT EXISTS cases (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        VARCHAR(500) NOT NULL,
    description  TEXT,
    status       VARCHAR(50)  NOT NULL DEFAULT 'OPEN',
    created_by   UUID         NOT NULL REFERENCES users(id),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Sketches  (Phase 2 columns — storage ready)
CREATE TABLE IF NOT EXISTS sketches (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id     UUID         NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    sketch_url  VARCHAR(1000),
    layers_json JSONB,
    status      VARCHAR(50)  NOT NULL DEFAULT 'DRAFT',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Criminal Profiles  (Phase 6 columns — storage ready)
CREATE TABLE IF NOT EXISTS criminal_profiles (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    dob              DATE,
    gender           VARCHAR(20),
    photo_url        VARCHAR(1000),
    embedding_vector JSONB,
    added_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Recognition Logs  (Phase 6)
CREATE TABLE IF NOT EXISTS recognition_logs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sketch_id            UUID           NOT NULL REFERENCES sketches(id),
    criminal_profile_id  UUID           NOT NULL REFERENCES criminal_profiles(id),
    similarity_score     DECIMAL(6, 4),
    rank                 INTEGER,
    created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    action      VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id   UUID,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_otp_email       ON otp_codes(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires     ON otp_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_cases_owner     ON cases(created_by);
CREATE INDEX IF NOT EXISTS idx_cases_status    ON cases(status);
CREATE INDEX IF NOT EXISTS idx_sketches_case   ON sketches(case_id);
CREATE INDEX IF NOT EXISTS idx_rlog_sketch     ON recognition_logs(sketch_id);
CREATE INDEX IF NOT EXISTS idx_audit_user      ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_time      ON audit_logs(created_at DESC);
