-- Migration: Add activeProjectId to sessions table
ALTER TABLE sessions ADD COLUMN active_project_id TEXT;
