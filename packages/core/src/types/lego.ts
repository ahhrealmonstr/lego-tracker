export type LegoItemType = 'set' | 'minifig';

export type AcquisitionQuality =
  | 'new'
  | 'new-open-box'
  | 'used-with-box-instructions'
  | 'used-no-box'
  | 'used-no-instructions'
  | 'used-missing-parts';

export type BuildStatus = 'not-started' | 'in-progress' | 'complete';

export type CollectionStatus = 'collection' | 'wishlist';

export interface LegoCatalogItem {
  id: string;
  type: LegoItemType;
  number: string;
  name: string;
  theme: string;
  year: number;
  pieceCount: number;
  retired: boolean;
  estimatedValue: number;
  imageUrl: string;
  barcode?: string;
}

export interface OwnedLegoItem extends LegoCatalogItem {
  status: CollectionStatus;
  acquiredQuality?: AcquisitionQuality;
  savedBox: boolean;
  buildStatus: BuildStatus;
  displayLocation: string;
  notes: string;
  missingParts: string;
  quantity: number;
  addedAt: string;
  updatedAt: string;
}

export interface CollectionSummary {
  collectionCount: number;
  wishlistCount: number;
  totalEstimatedValue: number;
  completeBuilds: number;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export type SyncQueueEntry =
  | { type: 'upsert'; item: OwnedLegoItem }
  | { type: 'delete'; itemId: string; deletedAt: string };
