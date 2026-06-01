-- Add added_at to persist OwnedLegoItem.addedAt (previously lost on sync)
-- Add deleted_at as a tombstone: NULL = live, non-null = deleted on some device
ALTER TABLE public.user_collection
  ADD COLUMN added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN deleted_at TIMESTAMPTZ;
