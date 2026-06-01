import { describe, it, expect, beforeEach } from 'vitest';
import { loadCollection, saveCollection } from './storage';
import type { OwnedLegoItem } from '@lego-tracker/core';

const baseItem: OwnedLegoItem = {
  id: 'set-10305', type: 'set', number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  pieceCount: 4514, retired: false, estimatedValue: 399.99,
  imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
  barcode: '673419357562', status: 'collection', acquiredQuality: 'new',
  savedBox: true, buildStatus: 'not-started', displayLocation: '',
  notes: '', missingParts: '', quantity: 1,
  addedAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('storage service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('loadCollection', () => {
    it('returns empty array when localStorage is empty', () => {
      expect(loadCollection()).toEqual([]);
    });

    it('returns parsed valid items from localStorage', () => {
      saveCollection([baseItem]);
      expect(loadCollection()).toHaveLength(1);
      expect(loadCollection()[0].id).toBe('set-10305');
    });

    it('filters out items that fail schema validation', () => {
      localStorage.setItem(
        'brick-ledger.collection.v1',
        JSON.stringify([baseItem, { id: 'bad', type: 'unknown' }]),
      );
      expect(loadCollection()).toHaveLength(1);
    });

    it('returns empty array on malformed JSON', () => {
      localStorage.setItem('brick-ledger.collection.v1', '{not valid json');
      expect(loadCollection()).toEqual([]);
    });

    it('returns empty array when stored value is not an array', () => {
      localStorage.setItem(
        'brick-ledger.collection.v1',
        JSON.stringify({ id: 'not-array' }),
      );
      expect(loadCollection()).toEqual([]);
    });
  });

  describe('saveCollection', () => {
    it('writes items to localStorage under the correct key', () => {
      saveCollection([baseItem]);
      const raw = localStorage.getItem('brick-ledger.collection.v1');
      expect(raw).not.toBeNull();
      expect(JSON.parse(raw!)).toHaveLength(1);
    });

    it('round-trips items through save + load', () => {
      saveCollection([baseItem]);
      expect(loadCollection()[0]).toEqual(baseItem);
    });
  });
});
