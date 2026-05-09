-- Create catalog cache table
CREATE TABLE public.catalog_cache (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('set', 'minifig')),
  number TEXT NOT NULL,
  name TEXT NOT NULL,
  theme TEXT NOT NULL,
  year INTEGER NOT NULL CHECK (year >= 1932 AND year <= EXTRACT(YEAR FROM now())::INT),
  piece_count INTEGER NOT NULL CHECK (piece_count >= 0),
  retired BOOLEAN NOT NULL DEFAULT false,
  estimated_value NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user collection table
CREATE TABLE public.user_collection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id TEXT NOT NULL REFERENCES public.catalog_cache(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('collection', 'wishlist')),
  acquired_quality TEXT CHECK (acquired_quality IN ('new', 'new-open-box', 'used-with-box-instructions', 'used-no-box', 'used-no-instructions', 'used-missing-parts')),
  saved_box BOOLEAN NOT NULL DEFAULT false,
  build_status TEXT NOT NULL CHECK (build_status IN ('not-started', 'in-progress', 'complete')),
  display_location TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  missing_parts TEXT DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID NOT NULL -- Required for ownership
);

-- Enable RLS
ALTER TABLE public.catalog_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

-- Catalog Cache Policies
CREATE POLICY "Public read access for catalog cache" ON public.catalog_cache 
  FOR SELECT USING (true);

CREATE POLICY "Admin insert access for catalog cache" ON public.catalog_cache 
  FOR INSERT WITH CHECK (auth.role() = 'authenticated'); -- Simple admin check for now

-- User Collection Policies (Restricted to owner)
CREATE POLICY "Users can manage their own collection" ON public.user_collection
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
