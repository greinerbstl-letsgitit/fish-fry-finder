-- Add purchasable_individually to menu_items.
-- Sides linked to entrees are not orderable directly unless this is true.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS purchasable_individually boolean DEFAULT false;
