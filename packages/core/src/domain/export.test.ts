import { describe, it, expect } from 'vitest';
import { collectionToJSON, collectionToCSV } from './export';
import type { OwnedLegoItem } from '../types/lego';

const baseItem: OwnedLegoItem = {
  id: 'set-10305', type: 'set', number: '10305',
  name: 'Lion Knights Castle', theme: 'Icons', year: 2022,
  pieceCount: 4514, retired: false, estimatedValue: 399.99,
  imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
  barcode: '673419357562', status: 'collection', acquiredQuality: 'new',
  savedBox: true, buildStatus: 'not-started', displayLocation: 'Office shelf',
  notes: '', missingParts: '', quantity: 1,
  addedAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('export domain', () => {
  describe('collectionToJSON', () => {
    it('returns valid JSON string', () => {
      expect(() => JSON.parse(collectionToJSON([baseItem]))).not.toThrow();
    });

    it('round-trips item fields through JSON', () => {
      const parsed = JSON.parse(collectionToJSON([baseItem]));
      expect(parsed[0].id).toBe('set-10305');
      expect(parsed[0].name).toBe('Lion Knights Castle');
    });

    it('returns empty array JSON for empty collection', () => {
      expect(collectionToJSON([])).toBe('[]');
    });
  });

  describe('collectionToCSV', () => {
    it('returns empty string for empty collection', () => {
      expect(collectionToCSV([])).toBe('');
    });

    it('produces header row + one data row for single item', () => {
      const lines = collectionToCSV([baseItem]).split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('id,type,number,name');
      expect(lines[1]).toContain('set-10305');
    });

    it('includes all expected header columns', () => {
      const headers = collectionToCSV([baseItem]).split('\n')[0].split(',');
      for (const col of ['id', 'status', 'quantity', 'addedAt']) {
        expect(headers).toContain(col);
      }
    });

    it('wraps values containing commas in double quotes', () => {
      const csv = collectionToCSV([{ ...baseItem, name: 'Castle, Lion' }]);
      expect(csv).toContain('"Castle, Lion"');
    });

    it('escapes embedded double quotes', () => {
      const csv = collectionToCSV([{ ...baseItem, displayLocation: 'He said "wow"' }]);
      expect(csv).toContain('"He said ""wow"""');
    });
  });
});
