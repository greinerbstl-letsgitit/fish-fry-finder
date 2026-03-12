-- Add ordering_enabled column to locations. Default false so ordering must be explicitly enabled.
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS ordering_enabled boolean NOT NULL DEFAULT false;
