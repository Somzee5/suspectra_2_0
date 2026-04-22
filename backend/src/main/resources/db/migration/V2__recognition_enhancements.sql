-- ─────────────────────────────────────────────────────────────
-- Suspectra 2.0 — V2 Recognition Enhancements
-- ─────────────────────────────────────────────────────────────

-- Extend criminal_profiles for Rekognition integration
ALTER TABLE criminal_profiles
    ADD COLUMN IF NOT EXISTS age                  INTEGER,
    ADD COLUMN IF NOT EXISTS crime_type           VARCHAR(100),
    ADD COLUMN IF NOT EXISTS description          TEXT,
    ADD COLUMN IF NOT EXISTS rekognition_face_id  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS s3_key               VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS suspect_ref          VARCHAR(50) UNIQUE;

-- One row per recognition search attempt (stores full results JSON)
CREATE TABLE IF NOT EXISTS recognition_runs (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID        NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    input_s3_key  VARCHAR(1000),
    top_matches   TEXT        NOT NULL DEFAULT '[]',
    total_found   INTEGER     NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_case      ON recognition_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_runs_created   ON recognition_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profile_ref    ON criminal_profiles(suspect_ref);
