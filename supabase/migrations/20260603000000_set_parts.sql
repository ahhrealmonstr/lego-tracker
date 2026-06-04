-- supabase/migrations/20260603000000_set_parts.sql
CREATE TABLE public.set_parts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      TEXT NOT NULL REFERENCES public.catalog_cache(id) ON DELETE CASCADE,
  part_num    TEXT NOT NULL,
  part_name   TEXT NOT NULL,
  color_name  TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity >= 1),
  bag_num     INTEGER,
  img_url     TEXT NOT NULL,
  is_spare    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (set_id, part_num, color_name)
);

ALTER TABLE public.set_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for set parts" ON public.set_parts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated insert for set parts" ON public.set_parts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
