-- Brewery Outreach Tracker
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS brewery_outreach (
  id               serial PRIMARY KEY,
  brewery_name     text NOT NULL,
  website          text,
  email            text,
  recommended_beer text,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','initial_send','follow_up','in_communication','agreed','opted_out')),
  notes            text,
  last_updated     timestamptz NOT NULL DEFAULT now()
);

-- Auto-update last_updated on row changes
CREATE OR REPLACE FUNCTION brewery_outreach_set_last_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS brewery_outreach_last_updated ON brewery_outreach;
CREATE TRIGGER brewery_outreach_last_updated
  BEFORE UPDATE ON brewery_outreach
  FOR EACH ROW EXECUTE FUNCTION brewery_outreach_set_last_updated();

-- Enable Row Level Security but allow anon reads (internal page, no auth needed)
ALTER TABLE brewery_outreach ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select" ON brewery_outreach
  FOR SELECT USING (true);

CREATE POLICY "Allow anon update" ON brewery_outreach
  FOR UPDATE USING (true);

-- Seed data — 31 Vancouver-area breweries
INSERT INTO brewery_outreach (brewery_name, website, recommended_beer) VALUES
  ('Bridge Brewing',               'bridgebrewing.com',        'West Coast IPA'),
  ('Parkside Brewery',             'parksidebrewery.ca',       'Seasonal Ale'),
  ('Coal Harbour Brewing',         'coalharbourbrewing.com',   'Session Lager'),
  ('Steamworks Brewing',           'steamworks.com',           'Heroica Oatmeal Stout'),
  ('Beere Brewing',                'beerebrewing.com',         'Dark Ale / Stout'),
  ('Postmark Brewing',             'postmarkbrewing.com',      'Pale Ale'),
  ('Superflux Beer Company',       'superfluxbeer.com',        'Hazy NEIPA'),
  ('Faculty Brewing',              'facultybrewing.com',       'European Lager'),
  ('Main Street Brewing',          'mainstreetbeer.ca',        'West Coast IPA'),
  ('33 Acres Brewing',             '33acres.com',              '33 Acres of Darkness'),
  ('Brassneck Brewery',            'brassneck.ca',             'Rotating Small-Batch Ale'),
  ('Brewhall',                     'brewhall.com',             'Lager'),
  ('R&B Brewing',                  'rbrewing.com',             'British-Style Porter'),
  ('Strathcona Beer Co.',          'strathconabeer.com',       'West Coast IPA'),
  ('Andina Brewing',               'andinabrewing.ca',         'Quinoa Ale'),
  ('Container Brewing',            'containerbrewing.com',     'Rotating Small-Batch Ale'),
  ('Callister Brewing',            'callisterbrewing.com',     'Rotating Nano Ale'),
  ('Bomber Brewing',               'bomberbrewing.com',        'Porter'),
  ('Off the Rail Brewing',         'offtherailbrewing.com',    'IPA'),
  ('Strange Fellows Brewing',      'strangefellowsbrewing.com','Belgian Farmhouse Saison'),
  ('Luppolo Brewing',              'luppolobrewing.ca',        'Italian Pilsner'),
  ('Dageraad Brewing',             'dageraadbrewing.com',      'Burnabarian Dubbel'),
  ('Steel & Oak Brewing',          'steelandoak.ca',           'Electric Märzen'),
  ('Dogwood Brewing',              'dogwoodbrewing.ca',        'Gluten-Free Craft Ale'),
  ('Fuggles & Warlock Craftworks', 'fugglesandwarlock.com',    'Taro Milk Tea Stout'),
  ('Four Winds Brewing',           'fourwindsbrewing.ca',      'Award-Winning Saison'),
  ('Moody Ales',                   'moodyales.com',            'West Coast IPA'),
  ('Twin Sails Brewing',           'twinsailsbrewing.com',     'Hazy NEIPA'),
  ('Yellow Dog Brewing',           'yellowdogbrewing.ca',      'Play Dead IPA'),
  ('Northpaw Brew Co',             'northpawbrew.com',         'Experimental Small-Batch'),
  ('Foamers'' Folly Brewing',      'foamersfolly.com',         'Fruit-Forward Adjunct Ale')
ON CONFLICT DO NOTHING;
