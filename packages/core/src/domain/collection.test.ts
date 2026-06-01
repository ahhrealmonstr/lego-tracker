import { describe, it, expect } from 'vitest';
import { createOwnedItem, summarizeCollection, upsertOwnedItem } from './collection';
import type { LegoCatalogItem, OwnedLegoItem } from '../types/lego';

const baseCatalogItem: LegoCatalogItem = {
  id: 'set-10305', type: 'set', number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  pieceCount: 4514, retired: false, estimatedValue: 399.99,
  imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
  barcode: '673419357562',
};

function makeOwned(
  status: 'collection' | 'wishlist',
  buildStatus: 'not-started' | 'in-progress' | 'complete' = 'not-started',
  quantity = 1,
  estimatedValue = 100,
): OwnedLegoItem {
  return {
    ...baseCatalogItem, status, acquiredQuality: 'new', savedBox: true,
    buildStatus, displayLocation: '', notes: '', missingParts: '',
    quantity, estimatedValue,
    addedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('collection domain', () => {
  describe('createOwnedItem', () => {
    it('creates collection item with acquiredQuality new and correct defaults', () => {
      const item = createOwnedItem(baseCatalogItem, 'collection');
      expect(item.status).toBe('collection');
      expect(item.acquiredQuality).toBe('new');
      expect(item.savedBox).toBe(true);
      expect(item.buildStatus).toBe('not-started');
      expect(item.quantity).toBe(1);
      expect(item.displayLocation).toBe('');
      expect(item.id).toBe(baseCatalogItem.id);
    });

    it('creates wishlist item without acquiredQuality', () => {
      const item = createOwnedItem(baseCatalogItem, 'wishlist');
      expect(item.status).toBe('wishlist');
      expect((item as any).acquiredQuality).toBeUndefined();
    });

    it('sets addedAt and updatedAt as valid ISO strings', () => {
      const item = createOwnedItem(baseCatalogItem, 'collection');
      expect(() => new Date(item.addedAt).toISOString()).not.toThrow();
      expect(() => new Date(item.updatedAt).toISOString()).not.toThrow();
    });
  });

  describe('summarizeCollection', () => {
    it('counts collection and wishlist items separately', () => {
      const summary = summarizeCollection([
        makeOwned('collection'), makeOwned('collection'), makeOwned('wishlist'),
      ]);
      expect(summary.collectionCount).toBe(2);
      expect(summary.wishlistCount).toBe(1);
    });

    it('sums estimated value × quantity for collection items only', () => {
      const summary = summarizeCollection([
        makeOwned('collection', 'not-started', 2, 100),
        makeOwned('wishlist', 'not-started', 1, 200),
      ]);
      expect(summary.totalEstimatedValue).toBe(200);
    });

    it('counts all items with complete buildStatus regardless of list', () => {
      const summary = summarizeCollection([
        makeOwned('collection', 'complete'),
        makeOwned('collection', 'in-progress'),
        makeOwned('wishlist', 'complete'),
      ]);
      expect(summary.completeBuilds).toBe(2);
    });

    it('returns all zeros for empty collection', () => {
      expect(summarizeCollection([])).toEqual({
        collectionCount: 0, wishlistCount: 0,
        totalEstimatedValue: 0, completeBuilds: 0,
      });
    });
  });

  describe('upsertOwnedItem', () => {
    const existingItem = makeOwned('collection');

    it('prepends new item when id does not exist in list', () => {
      const newItem = { ...existingItem, id: 'set-99999', name: 'New Set' };
      const result = upsertOwnedItem([existingItem], newItem);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('set-99999');
    });

    it('replaces existing item in-place when id matches', () => {
      const updated = { ...existingItem, notes: 'Updated note' };
      const result = upsertOwnedItem([existingItem], updated);
      expect(result).toHaveLength(1);
      expect(result[0].notes).toBe('Updated note');
    });

    it('bumps updatedAt on every upsert', () => {
      const before = existingItem.updatedAt;
      const result = upsertOwnedItem([existingItem], { ...existingItem, notes: 'x' });
      expect(result[0].updatedAt).not.toBe(before);
    });
  });
});
