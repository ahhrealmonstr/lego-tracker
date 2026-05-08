-- Create catalog cache table
CREATE TABLE public.catalog_cache (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('set', 'minifig')),
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  year INTEGER NOT NULL,
  piece_count INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user collection table
CREATE TABLE public.user_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('collection', 'wishlist')),
  acquired_quality TEXT NOT NULL,
  saved_box BOOLEAN NOT NULL DEFAULT false,
  build_status TEXT NOT NULL,
  display_location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  missing_parts TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID -- For future auth
);

-- Enable RLS
ALTER TABLE public.catalog_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

-- Basic Public Access (for now, until Auth is added)
CREATE POLICY "Public read access for catalog cache" ON public.catalog_cache FOR SELECT USING (true);
CREATE POLICY "Public insert access for catalog cache" ON public.catalog_cache FOR INSERT WITH CHECK (true);

CREATE POLICY "Public access for user collection" ON public.user_collection FOR ALL USING (true) WITH CHECK (true);
