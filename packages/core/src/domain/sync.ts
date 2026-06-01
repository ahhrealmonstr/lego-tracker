import type { OwnedLegoItem } from '../types/lego';

export function reconcileCollection(
  local: OwnedLegoItem[],
  remote: OwnedLegoItem[],
  tombstoneIds: string[],
): OwnedLegoItem[] {
  const tombstoneSet = new Set(tombstoneIds);

  // Step 1: remove tombstoned items from local (before LWW merge)
  const survivors = local.filter(item => !tombstoneSet.has(item.id));

  // Step 2: build a map of survivors for O(1) lookup
  const localMap = new Map(survivors.map(item => [item.id, item]));

  // Step 3: merge remote items — remote wins on tie or when remote is newer
  for (const remoteItem of remote) {
    const localItem = localMap.get(remoteItem.id);
    if (!localItem || remoteItem.updatedAt >= localItem.updatedAt) {
      localMap.set(remoteItem.id, remoteItem);
    }
  }

  return Array.from(localMap.values());
}
