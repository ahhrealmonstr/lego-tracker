import type { AcquisitionQuality, CollectionStatus, CollectionSummary, LegoCatalogItem, MissingSetPart, OwnedLegoItem, SetPart } from '../types/lego';

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
    missingPartsList: [],
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

export function toggleMissingPart(item: OwnedLegoItem, part: SetPart): OwnedLegoItem {
  const key = `${part.partNum}:${part.colorName}`;
  const existing = item.missingPartsList ?? [];
  const alreadyMissing = existing.some(p => `${p.partNum}:${p.colorName}` === key);
  const missingPartsList: MissingSetPart[] = alreadyMissing
    ? existing.filter(p => `${p.partNum}:${p.colorName}` !== key)
    : [...existing, {
        partNum: part.partNum,
        partName: part.partName,
        colorName: part.colorName,
        quantity: part.quantity,
        imgUrl: part.imgUrl,
      }];
  return { ...item, missingPartsList };
}

export function upsertOwnedItem(items: OwnedLegoItem[], nextItem: OwnedLegoItem): OwnedLegoItem[] {
  const updatedItem = { ...nextItem, updatedAt: new Date().toISOString() };
  const exists = items.some((item) => item.id === nextItem.id);
  if (!exists) {
    return [updatedItem, ...items];
  }

  return items.map((item) => (item.id === nextItem.id ? updatedItem : item));
}
