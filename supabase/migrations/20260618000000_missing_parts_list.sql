-- Add structured missing parts list column (M6 feature: missingPartsList)
-- JSONB array of { partNum, partName, colorName, quantity, imgUrl } objects
ALTER TABLE public.user_collection
  ADD COLUMN missing_parts_list JSONB NOT NULL DEFAULT '[]'::jsonb;
