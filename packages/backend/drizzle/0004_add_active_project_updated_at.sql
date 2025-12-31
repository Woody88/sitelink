-- Migration: Add activeProjectUpdatedAt to sessions table
ALTER TABLE sessions ADD COLUMN active_project_updated_at INTEGER;
