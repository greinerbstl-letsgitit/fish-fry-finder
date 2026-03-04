-- Rename category 'fish' to 'entree' in existing menu items.
UPDATE menu_items SET category = 'entree' WHERE category = 'fish';

-- Create entree_sides table for entree-side associations.
CREATE TABLE IF NOT EXISTS entree_sides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entree_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  side_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  max_sides smallint NOT NULL DEFAULT 1 CHECK (max_sides >= 0 AND max_sides <= 2),
  extra_charge numeric(10,2) NOT NULL DEFAULT 0,
  UNIQUE(entree_item_id, side_item_id)
);

CREATE INDEX IF NOT EXISTS idx_entree_sides_entree ON entree_sides(entree_item_id);
