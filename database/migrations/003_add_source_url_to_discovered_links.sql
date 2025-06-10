-- Migration: Add source_url column to discovered_links table
-- File: database/migrations/003_add_source_url_to_discovered_links.sql
-- Purpose: Store the source page URL where each link was discovered

BEGIN;

-- Add source_url column to discovered_links table
ALTER TABLE discovered_links 
ADD COLUMN source_url TEXT DEFAULT NULL;

-- Add index for performance on source_url queries
CREATE INDEX IF NOT EXISTS idx_discovered_links_source_url ON discovered_links(source_url);

-- Add comment for clarity
COMMENT ON COLUMN discovered_links.source_url IS 'The URL of the page where this link was discovered';

-- For existing records, we can set a default value
-- You might want to update these based on your specific needs
UPDATE discovered_links 
SET source_url = 'Discovery'
WHERE source_url IS NULL;

COMMIT;