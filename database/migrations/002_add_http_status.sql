-- Migration: Add HTTP status tracking to discovered_links table
-- File: database/migrations/002_add_http_status.sql
-- Purpose: Store actual HTTP response codes and timing data for better status reporting

-- Add HTTP status tracking columns to discovered_links table
ALTER TABLE discovered_links 
ADD COLUMN http_status_code INTEGER DEFAULT NULL,
ADD COLUMN response_time INTEGER DEFAULT NULL,
ADD COLUMN checked_at TIMESTAMP DEFAULT NULL,
ADD COLUMN error_message TEXT DEFAULT NULL,
ADD COLUMN is_working BOOLEAN DEFAULT NULL;

-- Add index for performance on common queries
CREATE INDEX idx_discovered_links_http_status ON discovered_links(http_status_code);
CREATE INDEX idx_discovered_links_is_working ON discovered_links(is_working);
CREATE INDEX idx_discovered_links_checked_at ON discovered_links(checked_at);

-- Add comments for clarity
COMMENT ON COLUMN discovered_links.http_status_code IS 'HTTP response status code (200, 404, 500, etc.)';
COMMENT ON COLUMN discovered_links.response_time IS 'Response time in milliseconds';
COMMENT ON COLUMN discovered_links.checked_at IS 'When the link was actually checked for status';
COMMENT ON COLUMN discovered_links.error_message IS 'Error message if link check failed';
COMMENT ON COLUMN discovered_links.is_working IS 'Boolean flag: true = working, false = broken, null = not checked yet';

-- Update existing records to have a default state
-- Set unchecked links to NULL status (will be updated when crawling completes)
UPDATE discovered_links 
SET is_working = NULL, 
    http_status_code = NULL,
    checked_at = NULL
WHERE status = 'pending';

-- For existing 'checked' records, we'll need to determine their status
-- This will be handled by the crawler update logic