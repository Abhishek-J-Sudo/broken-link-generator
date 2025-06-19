-- Supabase Migration: Add SEO Analysis Support
-- File: database/migrations/003_add_seo_analysis.sql

-- Step 1: Add SEO analysis table
CREATE TABLE IF NOT EXISTS seo_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    
    -- Meta Tags
    title_text TEXT,
    title_length INTEGER DEFAULT 0,
    meta_description TEXT,
    description_length INTEGER DEFAULT 0,
    canonical_url TEXT,
    
    -- Content Structure
    h1_count INTEGER DEFAULT 0,
    h2_count INTEGER DEFAULT 0,
    h3_count INTEGER DEFAULT 0,
    word_count INTEGER DEFAULT 0,
    content_length INTEGER DEFAULT 0,
    
    -- Images
    total_images INTEGER DEFAULT 0,
    missing_alt INTEGER DEFAULT 0,
    alt_coverage INTEGER DEFAULT 100,
    
    -- Technical
    is_https BOOLEAN DEFAULT false,
    response_time INTEGER,
    status_code INTEGER,
    
    -- SEO Score
    seo_score INTEGER DEFAULT 0 CHECK (seo_score >= 0 AND seo_score <= 100),
    seo_grade CHAR(1) CHECK (seo_grade IN ('A', 'B', 'C', 'D', 'F')),
    issues_count INTEGER DEFAULT 0,
    issues JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    UNIQUE(job_id, url)
);

-- Step 2: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_seo_job_id ON seo_analysis(job_id);
CREATE INDEX IF NOT EXISTS idx_seo_score ON seo_analysis(seo_score DESC);
CREATE INDEX IF NOT EXISTS idx_seo_grade ON seo_analysis(seo_grade);
CREATE INDEX IF NOT EXISTS idx_seo_https ON seo_analysis(is_https);
CREATE INDEX IF NOT EXISTS idx_seo_issues ON seo_analysis USING GIN(issues);

-- Step 3: Add SEO flag to existing discovered_links table
ALTER TABLE discovered_links 
ADD COLUMN IF NOT EXISTS has_seo_data BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_discovered_has_seo ON discovered_links(has_seo_data);

-- Step 4: Create materialized view for fast SEO summaries
CREATE MATERIALIZED VIEW IF NOT EXISTS seo_job_summary AS
SELECT 
    job_id,
    COUNT(*) as total_pages,
    ROUND(AVG(seo_score)) as avg_score,
    COUNT(*) FILTER (WHERE seo_grade = 'A') as grade_a_count,
    COUNT(*) FILTER (WHERE seo_grade = 'B') as grade_b_count,
    COUNT(*) FILTER (WHERE seo_grade = 'C') as grade_c_count,
    COUNT(*) FILTER (WHERE seo_grade = 'D') as grade_d_count,
    COUNT(*) FILTER (WHERE seo_grade = 'F') as grade_f_count,
    COUNT(*) FILTER (WHERE is_https = true) as https_pages,
    ROUND(AVG(response_time)) as avg_response_time,
    SUM(issues_count) as total_issues,
    MIN(seo_score) as min_score,
    MAX(seo_score) as max_score
FROM seo_analysis 
GROUP BY job_id;

-- Step 5: Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_seo_summary_job 
ON seo_job_summary(job_id);

-- Step 6: Function to refresh materialized view automatically
CREATE OR REPLACE FUNCTION refresh_seo_summary()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY seo_job_summary;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Trigger to auto-refresh summary when SEO data changes
DROP TRIGGER IF EXISTS trigger_refresh_seo_summary ON seo_analysis;
CREATE TRIGGER trigger_refresh_seo_summary
    AFTER INSERT OR UPDATE OR DELETE ON seo_analysis
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_seo_summary();

-- Step 8: Enable Row Level Security (RLS) for Supabase
ALTER TABLE seo_analysis ENABLE ROW LEVEL SECURITY;

-- Step 9: RLS Policy (adjust based on your auth setup)
-- This allows public read access - modify based on your security needs
CREATE POLICY "Allow public read access to SEO analysis" 
ON seo_analysis FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert to SEO analysis" 
ON seo_analysis FOR INSERT 
WITH CHECK (true);

-- Step 10: Create helpful views for common queries

-- View: Pages with SEO issues
CREATE OR REPLACE VIEW seo_pages_with_issues AS
SELECT 
    sa.*,
    cj.url as site_url,
    cj.status as job_status
FROM seo_analysis sa
JOIN crawl_jobs cj ON sa.job_id = cj.id
WHERE sa.issues_count > 0
ORDER BY sa.issues_count DESC, sa.seo_score ASC;

-- View: Top performing pages
CREATE OR REPLACE VIEW seo_top_pages AS
SELECT 
    sa.*,
    cj.url as site_url
FROM seo_analysis sa
JOIN crawl_jobs cj ON sa.job_id = cj.id
WHERE sa.seo_score >= 80
ORDER BY sa.seo_score DESC;

-- View: Pages needing attention
CREATE OR REPLACE VIEW seo_needs_attention AS
SELECT 
    sa.*,
    cj.url as site_url,
    CASE 
        WHEN sa.seo_score < 50 THEN 'Critical'
        WHEN sa.seo_score < 70 THEN 'Warning'
        ELSE 'Good'
    END as priority
FROM seo_analysis sa
JOIN crawl_jobs cj ON sa.job_id = cj.id
WHERE sa.seo_score < 70
ORDER BY sa.seo_score ASC;

-- Step 11: Create function to get common SEO issues
CREATE OR REPLACE FUNCTION get_common_seo_issues(job_uuid UUID, issue_limit INTEGER DEFAULT 10)
RETURNS TABLE(issue_message TEXT, issue_count BIGINT, issue_type TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (jsonb_array_elements(issues)->>'message')::TEXT as issue_message,
        COUNT(*) as issue_count,
        (jsonb_array_elements(issues)->>'type')::TEXT as issue_type
    FROM seo_analysis 
    WHERE job_id = job_uuid
    AND issues_count > 0
    GROUP BY issue_message, issue_type
    ORDER BY issue_count DESC
    LIMIT issue_limit;
END;
$$ LANGUAGE plpgsql;

-- Step 12: Add helpful comments
COMMENT ON TABLE seo_analysis IS 'SEO analysis data for crawled pages';
COMMENT ON COLUMN seo_analysis.issues IS 'JSONB array of SEO issues found on the page';
COMMENT ON COLUMN seo_analysis.seo_score IS 'SEO score from 0-100';
COMMENT ON MATERIALIZED VIEW seo_job_summary IS 'Aggregated SEO statistics per crawl job';

-- Step 13: Create storage bucket for SEO reports (optional)
-- INSERT INTO storage.buckets (id, name, public) 
-- VALUES ('seo-reports', 'seo-reports', true);

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON TABLE seo_analysis TO anon, authenticated;
GRANT ALL ON TABLE seo_job_summary TO anon, authenticated;
GRANT SELECT ON seo_pages_with_issues TO anon, authenticated;
GRANT SELECT ON seo_top_pages TO anon, authenticated;
GRANT SELECT ON seo_needs_attention TO anon, authenticated;