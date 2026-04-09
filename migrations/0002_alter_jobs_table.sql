-- Migration: Update jobs table to new marketplace schema
-- The existing jobs table has old columns (seller_id, service_category, stripe fields)
-- SQLite doesn't support DROP COLUMN easily, so we add the new columns

-- Add new columns to jobs (these will silently fail if they already exist — run manually)
ALTER TABLE jobs ADD COLUMN buyer_id TEXT REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN assigned_pro_id TEXT REFERENCES users(id);
ALTER TABLE jobs ADD COLUMN category TEXT;
ALTER TABLE jobs ADD COLUMN budget_pence INTEGER;
ALTER TABLE jobs ADD COLUMN postcode TEXT;
ALTER TABLE jobs ADD COLUMN urgency TEXT DEFAULT 'normal';
ALTER TABLE jobs ADD COLUMN updated_at TEXT;

-- Copy seller_id → buyer_id for existing rows (if seller_id exists)
-- UPDATE jobs SET buyer_id = seller_id WHERE buyer_id IS NULL AND seller_id IS NOT NULL;

-- Note: Run each ALTER TABLE statement individually if batch execution fails.
-- D1 may require running ALTER TABLE statements one at a time.
