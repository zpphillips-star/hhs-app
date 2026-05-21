-- HHS Agreed Order Data Migration
-- Adds $ per order, # of beers, and computed price per beer
-- Run in the Supabase SQL editor

ALTER TABLE brewery_outreach
  ADD COLUMN IF NOT EXISTS order_total    numeric(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS beer_count     integer       DEFAULT 31,
  ADD COLUMN IF NOT EXISTS price_per_beer numeric(10,4)
    GENERATED ALWAYS AS (
      CASE WHEN beer_count > 0 AND order_total IS NOT NULL
           THEN order_total / beer_count
           ELSE NULL
      END
    ) STORED;
