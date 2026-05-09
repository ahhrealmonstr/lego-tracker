import type { AcquisitionQuality, CollectionStatus, CollectionSummary, LegoCatalogItem, OwnedLegoItem } from '../types/lego';

export function createOwnedItem(item: LegoCatalogItem, status: CollectionStatus): OwnedLegoItem {
  const now = new Date().toISOString();

  return {
    ...item,
    status,
    ...(status === 'collection' ? { acquiredQuality: 'new' as AcquisitionQuality } : {}),
    savedBox: true,
    buildStatus: status === 'collection' ? 'not-started' : 'not-started',
    displayLocation: '',
    notes: '',
    missingParts: '',
    quantity: 1,
    addedAt: now,
    updatedAt: now,
  };
}

export function summarizeCollection(items: OwnedLegoItem[]): CollectionSummary {
  return {
    collectionCount: items.filter((item) => item.status === 'collection').length,
    wishlistCount: items.filter((item) => item.status === 'wishlist').length,
    totalEstimatedValue: items
      .filter((item) => item.status === 'collection')
      .reduce((total, item) => total + item.estimatedValue * item.quantity, 0),
    completeBuilds: items.filter((item) => item.buildStatus === 'complete').length,
  };
}

export function upsertOwnedItem(items: OwnedLegoItem[], nextItem: OwnedLegoItem): OwnedLegoItem[] {
  const updatedItem = { ...nextItem, updatedAt: new Date().toISOString() };
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) {
    return [updatedItem, ...items];
  }

  return items.map((item) => (item.id === nextItem.id ? updatedItem : item));
}
