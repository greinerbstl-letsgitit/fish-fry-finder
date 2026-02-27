-- Add dine-in and pickup filtering to menu items.
-- Run in Supabase SQL Editor or via: supabase db push
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS dine_in_only boolean DEFAULT false;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS pickup_only boolean DEFAULT false;
