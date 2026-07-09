-- =============================================================================
--  Plain-Postgres schema for SeoScrub (Coolify / self-hosted).
--  Consolidates database/schema.sql + migrations 001-004 into one idempotent
--  script that runs on a vanilla PostgreSQL 13+ instance (no Supabase).
--
--  Run once against your Coolify Postgres:
--     psql "$DATABASE_URL" -f database/init.sql
--     -- or --
--     npm run db:init
--
--  Notes on deliberate deviations from the original Supabase schema:
--   * `status` / `error_type` columns are TEXT (not ENUM). The app writes
--     values such as 'ready_for_checking' that were never in the original
--     enums, so TEXT avoids invalid-enum-cast failures.
--   * `seo_job_summary` is a plain VIEW (not MATERIALIZED). It is always
--     current and needs no refresh trigger.
--   * No RLS / GRANT statements: a single app role owns everything.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- provides gen_random_uuid()

-- ---------------------------------------------------------------------------
-- crawl_jobs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url           TEXT NOT NULL,
    status        TEXT DEFAULT 'queued',
    progress      JSONB DEFAULT '{"current": 0, "total": 0, "percentage": 0}',
    settings      JSONB DEFAULT '{"maxDepth": 3, "includeExternal": false, "timeout": 10000}',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    completed_at  TIMESTAMPTZ,
    error_message TEXT,
    heartbeat_at  TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- broken_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS broken_links (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id      UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    source_url  TEXT,
    status_code INTEGER,
    error_type  TEXT,
    link_text   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- discovered_links
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS discovered_links (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id           UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url              TEXT NOT NULL,
    source_url       TEXT,
    status           TEXT DEFAULT 'pending',
    is_internal      BOOLEAN DEFAULT true,
    depth            INTEGER DEFAULT 0,
    -- HTTP status tracking (migration 002)
    http_status_code INTEGER,
    response_time    INTEGER,
    checked_at       TIMESTAMPTZ,
    error_message    TEXT,
    is_working       BOOLEAN,
    -- SEO flag (migration 004)
    has_seo_data     BOOLEAN DEFAULT false,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (job_id, url)
);

-- ---------------------------------------------------------------------------
-- seo_analysis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seo_analysis (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id             UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url                TEXT NOT NULL,
    -- Meta tags
    title_text         TEXT,
    title_length       INTEGER DEFAULT 0,
    meta_description   TEXT,
    description_length INTEGER DEFAULT 0,
    canonical_url      TEXT,
    -- Content structure
    h1_count           INTEGER DEFAULT 0,
    h2_count           INTEGER DEFAULT 0,
    h3_count           INTEGER DEFAULT 0,
    word_count         INTEGER DEFAULT 0,
    content_length     INTEGER DEFAULT 0,
    -- Images
    total_images       INTEGER DEFAULT 0,
    missing_alt        INTEGER DEFAULT 0,
    alt_coverage       INTEGER DEFAULT 100,
    -- Technical
    is_https           BOOLEAN DEFAULT false,
    response_time      INTEGER,
    status_code        INTEGER,
    -- SEO score
    seo_score          INTEGER DEFAULT 0 CHECK (seo_score >= 0 AND seo_score <= 100),
    seo_grade          CHAR(1) CHECK (seo_grade IN ('A', 'B', 'C', 'D', 'F')),
    issues_count       INTEGER DEFAULT 0,
    issues             JSONB DEFAULT '[]'::jsonb,
    -- Timestamps
    analyzed_at        TIMESTAMPTZ DEFAULT NOW(),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (job_id, url)
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created_at        ON crawl_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status            ON crawl_jobs (status);

CREATE INDEX IF NOT EXISTS idx_broken_links_job_id          ON broken_links (job_id);
CREATE INDEX IF NOT EXISTS idx_broken_links_error_type      ON broken_links (job_id, error_type);

CREATE INDEX IF NOT EXISTS idx_discovered_links_job_status  ON discovered_links (job_id, status);
CREATE INDEX IF NOT EXISTS idx_discovered_links_job_url     ON discovered_links (job_id, url);
CREATE INDEX IF NOT EXISTS idx_discovered_links_http_status ON discovered_links (http_status_code);
CREATE INDEX IF NOT EXISTS idx_discovered_links_is_working  ON discovered_links (is_working);
CREATE INDEX IF NOT EXISTS idx_discovered_links_source_url  ON discovered_links (source_url);
CREATE INDEX IF NOT EXISTS idx_discovered_has_seo           ON discovered_links (has_seo_data);

CREATE INDEX IF NOT EXISTS idx_seo_job_id                   ON seo_analysis (job_id);
CREATE INDEX IF NOT EXISTS idx_seo_score                    ON seo_analysis (seo_score DESC);
CREATE INDEX IF NOT EXISTS idx_seo_grade                    ON seo_analysis (seo_grade);
CREATE INDEX IF NOT EXISTS idx_seo_https                    ON seo_analysis (is_https);
CREATE INDEX IF NOT EXISTS idx_seo_issues                   ON seo_analysis USING GIN (issues);

-- ---------------------------------------------------------------------------
-- seo_job_summary: aggregated SEO stats per job (plain VIEW, always current)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW seo_job_summary AS
SELECT
    job_id,
    COUNT(*)                                   AS total_pages,
    ROUND(AVG(seo_score))                      AS avg_score,
    COUNT(*) FILTER (WHERE seo_grade = 'A')    AS grade_a_count,
    COUNT(*) FILTER (WHERE seo_grade = 'B')    AS grade_b_count,
    COUNT(*) FILTER (WHERE seo_grade = 'C')    AS grade_c_count,
    COUNT(*) FILTER (WHERE seo_grade = 'D')    AS grade_d_count,
    COUNT(*) FILTER (WHERE seo_grade = 'F')    AS grade_f_count,
    COUNT(*) FILTER (WHERE is_https = true)     AS https_pages,
    ROUND(AVG(response_time))                  AS avg_response_time,
    SUM(issues_count)                          AS total_issues,
    MIN(seo_score)                             AS min_score,
    MAX(seo_score)                             AS max_score
FROM seo_analysis
GROUP BY job_id;
