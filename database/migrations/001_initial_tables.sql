-- Migration: 001_initial_tables.sql
-- Description: Create initial tables for broken link checker
-- Date: 2025-06-08

BEGIN;

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types for better data integrity
DO $$ BEGIN
    CREATE TYPE crawl_status AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE link_status AS ENUM ('pending', 'checked', 'skipped');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE error_type AS ENUM ('404', '500', '403', '401', 'timeout', 'dns_error', 'connection_error', 'invalid_url', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Job tracking table
CREATE TABLE IF NOT EXISTS crawl_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    url TEXT NOT NULL,
    status crawl_status DEFAULT 'pending',
    progress JSONB DEFAULT '{"current": 0, "total": 0, "percentage": 0}',
    settings JSONB DEFAULT '{"maxDepth": 3, "includeExternal": false, "timeout": 10000}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT
);

-- Broken links results table
CREATE TABLE IF NOT EXISTS broken_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    url TEXT NOT NULL,
    source_url TEXT NOT NULL,
    status_code INTEGER,
    error_type error_type NOT NULL,
    link_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_broken_links_job FOREIGN KEY (job_id) REFERENCES crawl_jobs(id) ON DELETE CASCADE
);

-- Discovered links table
CREATE TABLE IF NOT EXISTS discovered_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL,
    url TEXT NOT NULL,
    status link_status DEFAULT 'pending',
    is_internal BOOLEAN DEFAULT true,
    depth INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_discovered_links_job FOREIGN KEY (job_id) REFERENCES crawl_jobs(id) ON DELETE CASCADE,
    CONSTRAINT uk_discovered_links_job_url UNIQUE(job_id, url)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_created_at ON crawl_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crawl_jobs_status ON crawl_jobs(status);
CREATE INDEX IF NOT EXISTS idx_broken_links_job_id ON broken_links(job_id);
CREATE INDEX IF NOT EXISTS idx_broken_links_error_type ON broken_links(job_id, error_type);
CREATE INDEX IF NOT EXISTS idx_discovered_links_job_status ON discovered_links(job_id, status);
CREATE INDEX IF NOT EXISTS idx_discovered_links_job_url ON discovered_links(job_id, url);

COMMIT;