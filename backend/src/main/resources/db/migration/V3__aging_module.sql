-- ─────────────────────────────────────────────────────────────────────────────
-- Suspectra 2.0 — V3 Aging Module
-- Stores age-invariant recognition runs: which variants were tried,
-- the best match found, and which age delta produced it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS aging_runs (
    id                 UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id            UUID          NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    age_steps          VARCHAR(200)  NOT NULL DEFAULT '[-20,-10,0,10,20]',
    variants_count     INTEGER       NOT NULL DEFAULT 0,
    -- Best match metadata (denormalized for fast dashboard display)
    best_match_id      VARCHAR(100),
    best_match_name    VARCHAR(255),
    best_match_score   NUMERIC(6, 3),
    source_variant     VARCHAR(20),   -- e.g. '+10' or '-20'
    total_matches      INTEGER       NOT NULL DEFAULT 0,
    -- Full ranked result list as JSON (mirrors recognition_runs.top_matches pattern)
    all_results        TEXT          NOT NULL DEFAULT '[]',
    created_at         TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aging_case    ON aging_runs(case_id);
CREATE INDEX IF NOT EXISTS idx_aging_created ON aging_runs(created_at DESC);
