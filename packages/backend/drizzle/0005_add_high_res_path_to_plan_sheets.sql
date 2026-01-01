-- Migration: Add high_res_path to plan_sheets table for storing high-resolution JPEG paths
ALTER TABLE plan_sheets ADD COLUMN high_res_path TEXT;
