-- Add approved column to locations. New signups start as unapproved.
-- Existing locations default to approved so they remain visible.
ALTER TABLE locations
ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT true;
