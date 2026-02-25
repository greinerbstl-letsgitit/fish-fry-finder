-- Add lat and lng columns to locations for distance calculations.
-- Run this in Supabase SQL Editor or via: supabase db push
-- Lat/lng are auto-populated when admins save a location with a zip code.
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS lat double precision,
ADD COLUMN IF NOT EXISTS lng double precision;
