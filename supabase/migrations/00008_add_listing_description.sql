-- Migration: Add listing_description column to properties table
-- Purpose: Enables AI-powered feature matching against client brief requirements
-- Sprint 1: AI Foundation

ALTER TABLE properties
ADD COLUMN IF NOT EXISTS listing_description TEXT;

-- Full-text search index for listing descriptions
CREATE INDEX IF NOT EXISTS idx_properties_listing_description
ON properties USING GIN (to_tsvector('english', COALESCE(listing_description, '')));
