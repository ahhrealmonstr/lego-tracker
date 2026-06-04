# Bag Parts View

## Summary

Add a read-only reference view to the DetailPanel that shows the full part list for a set, grouped by bag. Part data is fetched from Rebrickable on first view and persisted to Supabase so subsequent loads are instant. Part images are shown per piece. Minifigs are excluded — this feature is sets-only.

## Status

proposed

## Milestone

M5

---

## Requirements

- When a set's detail panel is opened, its parts are displayed grouped by bag number
- Parts include: thumbnail image, part number, color name, quantity
- If Rebrickable provides bag sub-set data, parts are grouped under collapsible bag headings ("Bag 1", "Bag 2", ...)
- If no bag breakdown is available, all parts appear in a single flat list under "Parts (N total)"
- Spare parts are shown in a separate collapsed section ("Spare parts") at the bottom
- Part data is fetched from Rebrickable on first view and cached to Supabase; subsequent views read from Supabase
- If Rebrickable is unconfigured or fetch fails, the parts section is omitted silently (no error for missing API key) or shows a small inline error (network failure mid-fetch)
- Minifigs never show the parts section

---

## Architecture

```text
DetailPanel
  └── PartsList (new component)
        └── useSetParts (new hook)
              └── getOrFetchSetParts (catalog.ts — new)
                    ├── getSetParts (supabase.ts — new)        [read path]
                    └── fetchSetInventorySets +                [fetch path]
                        fetchPartsForInventory (rebrickable.ts — new)
                              └── cacheSetParts (supabase.ts — new)
```

---

## Data Model

New table in Supabase alongside `catalog_cache`:

```sql
CREATE TABLE public.set_parts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id      TEXT NOT NULL REFERENCES public.catalog_cache(id) ON DELETE CASCADE,
  part_num    TEXT NOT NULL,
  part_name   TEXT NOT NULL,
  color_name  TEXT NOT NULL,
  quantity    INTEGER NOT NULL CHECK (quantity >= 1),
  bag_num     INTEGER,        -- NULL = no bag breakdown available
  img_url     TEXT NOT NULL,
  is_spare    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (set_id, part_num, color_name)
);

-- RLS
ALTER TABLE public.set_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for set parts" ON public.set_parts
  FOR SELECT USING (true);

CREATE POLICY "Authenticated insert for set parts" ON public.set_parts
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
```

`bag_num` is nullable: NULL means the set has no bag sub-set breakdown on Rebrickable.  
One row per unique (set_id, part_num, color_name) combination.  
Sits in the catalog layer — shared across all users, not user-specific.

New type in `packages/core/src/types/lego.ts`:

```ts
export interface SetPart {
  partNum: string;
  partName: string;
  colorName: string;
  quantity: number;
  bagNum: number | null;
  imgUrl: string;
  isSpare: boolean;
}
```

---

## Service Layer

### `packages/core/src/services/rebrickable.ts`

Two new fetch functions:

```ts
// Returns inventory sub-sets (bags) for a set
fetchSetInventorySets(setNum: string): Promise<InventorySet[]>
// GET /sets/{set_num}/sets/
// Returns [] if no bag breakdown exists

// Returns all parts for a set or bag, following pagination
fetchPartsForInventory(setNum: string): Promise<RebrickablePart[]>
// GET /sets/{set_num}/parts/?page_size=100
// Follows `next` links until exhausted
```

Rebrickable paginates parts at 100 per page. `fetchPartsForInventory` follows `next` until all pages are consumed — necessary for large sets (Titanic: 9090 pieces).

### `packages/core/src/services/supabase.ts`

```ts
getSetParts(setId: string): Promise<SetPart[]>
// SELECT * FROM set_parts WHERE set_id = setId

cacheSetParts(setId: string, parts: SetPart[]): Promise<void>
// INSERT ... ON CONFLICT DO NOTHING
```

### `packages/core/src/domain/catalog.ts`

```ts
getOrFetchSetParts(item: LegoCatalogItem): Promise<SetPart[]>
```

1. Call `getSetParts(item.id)` — if rows exist, return them
2. Call `fetchSetInventorySets(item.number)`:
   - If bags returned: call `fetchPartsForInventory` per bag, tag each part with its `bag_num`
   - If no bags: call `fetchPartsForInventory` on the main set number, `bag_num = null`
3. Call `cacheSetParts(item.id, parts)` in the background
4. Return parts

Returns `[]` if Rebrickable is unconfigured or any unrecoverable error occurs.

---

## UI Layer

### `apps/web/src/hooks/useSetParts.ts`

```ts
useSetParts(item: LegoCatalogItem | undefined): {
  parts: SetPart[];
  loading: boolean;
  error: boolean;
}
```

- Only fires for `item.type === 'set'`; returns `{ parts: [], loading: false, error: false }` for minifigs and undefined
- Calls `getOrFetchSetParts` on item change
- Sets `loading: true` during fetch, `error: true` on network failure

### `apps/web/src/components/PartsList.tsx`

- Receives `item: LegoCatalogItem`; internally calls `useSetParts`
- Shows a loading skeleton during first fetch
- Groups non-spare parts by `bag_num`; each bag renders as a `<details>` element (collapsed by default)
- Bag heading: "Bag {n}" when `bag_num` is set; "Parts ({n} total)" when null
- Each part card: thumbnail image, part number, color name, quantity badge
- Spare parts: single `<details>` at the bottom, collapsed by default, heading "Spare parts ({n})"
- On `error: true`: inline message "Couldn't load parts" with no retry

### `apps/web/src/components/DetailPanel.tsx`

Add at the bottom of the panel, outside the owned-item form, visible regardless of collection status:

```tsx
{item.type === 'set' && <PartsList item={item} />}
```

---

## Error Handling

| Scenario | Behaviour |
| --- | --- |
| No Rebrickable API key | `getOrFetchSetParts` returns `[]`; `PartsList` renders nothing |
| Set has no parts on Rebrickable | Returns `[]`; `PartsList` renders nothing |
| Network error mid-fetch | Partial results discarded; `useSetParts` sets `error: true`; inline "Couldn't load parts" shown |
| Large set (pagination) | `fetchPartsForInventory` follows `next` links until exhausted |
| Minifig passed in | `useSetParts` returns empty immediately; no fetch attempted |
| No bag sub-set breakdown | All parts rendered flat under "Parts (N total)" |

---

## Testing

- Unit: `getOrFetchSetParts` — cache hit path, cache miss + fetch path, no-API-key path, paginated fetch
- Unit: `useSetParts` — loading state, error state, minifig short-circuit
- Unit: `PartsList` — renders bags grouped, renders flat when `bag_num` null, spare parts section
- Integration: Rebrickable fetch → cache → read-back round trip (mocked network)
