-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types for better data integrity
CREATE TYPE crawl_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE link_status AS ENUM ('pending', 'checked', 'skipped');
CREATE TYPE error_type AS ENUM ('404', '500', '403', '401', 'timeout', 'dns_error', 'connection_error', 'invalid_url', 'other');

-- Job tracking table
CREATE TABLE crawl_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    status crawl_status DEFAULT 'pending',
    progress JSONB DEFAULT '{"current": 0, "total": 0, "percentage": 0}',
    settings JSONB DEFAULT '{"maxDepth": 3, "includeExternal": false, "timeout": 10000}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Indexes for performance
    CREATED_AT_INDEX
);

-- Broken links results table
CREATE TABLE broken_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    source_url TEXT NOT NULL,
    status_code INTEGER,
    error_type error_type NOT NULL,
    link_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Composite index for efficient queries
    INDEX_JOB_ERROR
);

-- Discovered links table (for progress tracking)
CREATE TABLE discovered_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    status link_status DEFAULT 'pending',
    is_internal BOOLEAN DEFAULT true,
    depth INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint to prevent duplicates
    UNIQUE(job_id, url),
    
    -- Indexes for efficient lookups
    INDEX_JOB_STATUS,
    INDEX_JOB_URL
);

-- Indexes for performance optimization
CREATE INDEX idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC);
CREATE INDEX idx_crawl_jobs_status ON crawl_jobs(status);

CREATE INDEX idx_broken_links_job_id ON broken_links(job_id);
CREATE INDEX idx_broken_links_error_type ON broken_links(job_id, error_type);

CREATE INDEX idx_discovered_links_job_status ON discovered_links(job_id, status);
CREATE INDEX idx_discovered_links_job_url ON discovered_links(job_id, url);

-- Views for common queries
CREATE VIEW job_summary AS 
SELECT 
    j.id,
    j.url,
    j.status,
    j.progress,
    j.created_at,
    j.completed_at,
    COUNT(bl.id) as broken_count,
    COUNT(dl.id) as total_links
FROM crawl_jobs j
LEFT JOIN broken_links bl ON j.id = bl.job_id
LEFT JOIN discovered_links dl ON j.id = dl.job_id
GROUP BY j.id, j.url, j.status, j.progress, j.created_at, j.completed_at;

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_job_progress(
    p_job_id UUID,
    p_current INTEGER,
    p_total INTEGER
) RETURNS VOID AS $$
DECLARE
    v_percentage DECIMAL;
BEGIN
    -- Calculate percentage (avoid division by zero)
    IF p_total > 0 THEN
        v_percentage := ROUND((p_current::DECIMAL / p_total::DECIMAL) * 100, 2);
    ELSE
        v_percentage := 0;
    END IF;
    
    -- Update the job progress
    UPDATE crawl_jobs 
    SET progress = jsonb_build_object(
        'current', p_current,
        'total', p_total,
        'percentage', v_percentage
    )
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old jobs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_jobs(days_old INTEGER DEFAULT 30) 
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM crawl_jobs 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;