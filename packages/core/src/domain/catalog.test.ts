import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findByBarcode, searchCatalog, seedCatalog } from './catalog';
import { getCachedItemByBarcode, cacheCatalogItem } from '../services/supabase';
import { findRebrickableByBarcode, searchRebrickable } from '../services/rebrickable';

vi.mock('../services/supabase', () => ({
  getCachedItemByBarcode: vi.fn(),
  cacheCatalogItem: vi.fn().mockResolvedValue(undefined),
  getCachedItem: vi.fn(),
}));

vi.mock('../services/rebrickable', () => ({
  findRebrickableByBarcode: vi.fn(),
  searchRebrickable: vi.fn(),
  findRebrickableItem: vi.fn(),
}));

describe('Catalog Domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByBarcode', () => {
    it('should return item from seedCatalog if present', async () => {
      const seedItem = seedCatalog[0];
      const result = await findByBarcode(seedItem.barcode!);
      
      expect(result).toEqual(seedItem);
      expect(getCachedItemByBarcode).not.toHaveBeenCalled();
      expect(findRebrickableByBarcode).not.toHaveBeenCalled();
    });

    it('should return item from cache if not in seedCatalog', async () => {
      const barcode = '1234567890123';
      const cachedItem = { id: 'cached-1', barcode, name: 'Cached Set', type: 'set' };
      
      (getCachedItemByBarcode as any).mockResolvedValueOnce(cachedItem);

      const result = await findByBarcode(barcode);
      
      expect(result).toEqual(cachedItem);
      expect(getCachedItemByBarcode).toHaveBeenCalledWith(barcode);
      expect(findRebrickableByBarcode).not.toHaveBeenCalled();
    });

    it('should return item from Rebrickable and cache it if not in seed or cache', async () => {
      const barcode = '9876543210987';
      const externalItem = { id: 'external-1', barcode, name: 'External Set', type: 'set' };
      
      (getCachedItemByBarcode as any).mockResolvedValueOnce(null);
      (findRebrickableByBarcode as any).mockResolvedValueOnce(externalItem);

      const result = await findByBarcode(barcode);
      
      expect(result).toEqual(externalItem);
      expect(findRebrickableByBarcode).toHaveBeenCalledWith(barcode);
      expect(cacheCatalogItem).toHaveBeenCalledWith(externalItem);
    });

    it('should return undefined if not found in any source', async () => {
      const barcode = '0000000000000';

      (getCachedItemByBarcode as any).mockResolvedValueOnce(null);
      (findRebrickableByBarcode as any).mockResolvedValueOnce(null);

      const result = await findByBarcode(barcode);

      expect(result).toBeUndefined();
    });
  });

  describe('searchCatalog', () => {
    // ------------------------------------------------------------------ //
    // Short / empty queries — no external call                            //
    // ------------------------------------------------------------------ //

    it('should return all seed items when query is empty', async () => {
      const results = await searchCatalog('');

      expect(results).toEqual(seedCatalog);
      expect(searchRebrickable).not.toHaveBeenCalled();
    });

    it('should return all seed items when query is only whitespace', async () => {
      const results = await searchCatalog('   ');

      expect(results).toEqual(seedCatalog);
      expect(searchRebrickable).not.toHaveBeenCalled();
    });

    it('should return local matches without calling external API when query is fewer than 3 characters', async () => {
      // 'at' matches 'AT-AT' (set-75313)
      const results = await searchCatalog('at');

      expect(results.some((item) => item.id === 'set-75313')).toBe(true);
      expect(searchRebrickable).not.toHaveBeenCalled();
    });

    // ------------------------------------------------------------------ //
    // Queries >= 3 chars — local + external                               //
    // ------------------------------------------------------------------ //

    it('should call searchRebrickable and return combined results when query is 3 or more characters', async () => {
      const externalItem = {
        id: 'set-99999',
        type: 'set' as const,
        number: '99999',
        name: 'External Castle',
        theme: 'Icons',
        year: 2023,
        pieceCount: 100,
        retired: false,
        estimatedValue: 49.99,
        imageUrl: 'https://example.com/99999.jpg',
      };

      (searchRebrickable as any).mockResolvedValueOnce([externalItem]);

      const results = await searchCatalog('cas');

      expect(searchRebrickable).toHaveBeenCalledWith('cas');
      expect(results.some((item) => item.id === externalItem.id)).toBe(true);
    });

    it('should normalize the query before matching (trim and lowercase)', async () => {
      (searchRebrickable as any).mockResolvedValueOnce([]);

      // '  Icons  ' trimmed+lowercased becomes 'icons' — matches set-10305 and set-10294
      const results = await searchCatalog('  Icons  ');

      const iconsSets = seedCatalog.filter((item) => item.theme === 'Icons');
      for (const expected of iconsSets) {
        expect(results.some((item) => item.id === expected.id)).toBe(true);
      }
    });

    it('should prefer local seed item over external item when IDs collide', async () => {
      const localItem = seedCatalog.find((item) => item.id === 'set-10305')!;
      const externalDuplicate = {
        ...localItem,
        name: 'External Duplicate Name',
      };

      (searchRebrickable as any).mockResolvedValueOnce([externalDuplicate]);

      const results = await searchCatalog('castle');

      const matches = results.filter((item) => item.id === 'set-10305');
      expect(matches).toHaveLength(1);
      expect(matches[0].name).toBe(localItem.name);
    });

    it('should append non-colliding external results after local results', async () => {
      const externalItem = {
        id: 'set-77777',
        type: 'set' as const,
        number: '77777',
        name: 'Castle Dragon',
        theme: 'Castle',
        year: 2024,
        pieceCount: 500,
        retired: false,
        estimatedValue: 59.99,
        imageUrl: 'https://example.com/77777.jpg',
      };

      (searchRebrickable as any).mockResolvedValueOnce([externalItem]);

      const results = await searchCatalog('castle');

      const externalIndex = results.findIndex((item) => item.id === 'set-77777');
      const localIndex = results.findIndex((item) => item.id === 'set-10305');
      expect(externalIndex).toBeGreaterThan(localIndex);
    });

    it('should call cacheCatalogItem for each external result', async () => {
      const externalItems = [
        {
          id: 'set-11111',
          type: 'set' as const,
          number: '11111',
          name: 'Star Destroyer',
          theme: 'Star Wars',
          year: 2024,
          pieceCount: 1200,
          retired: false,
          estimatedValue: 149.99,
          imageUrl: 'https://example.com/11111.jpg',
        },
        {
          id: 'set-22222',
          type: 'set' as const,
          number: '22222',
          name: 'Star Base',
          theme: 'Star Wars',
          year: 2024,
          pieceCount: 800,
          retired: false,
          estimatedValue: 99.99,
          imageUrl: 'https://example.com/22222.jpg',
        },
      ];

      (searchRebrickable as any).mockResolvedValueOnce(externalItems);

      await searchCatalog('star');

      expect(cacheCatalogItem).toHaveBeenCalledTimes(externalItems.length);
      for (const item of externalItems) {
        expect(cacheCatalogItem).toHaveBeenCalledWith(item);
      }
    });

    it('should return only local results when searchRebrickable returns an empty array', async () => {
      (searchRebrickable as any).mockResolvedValueOnce([]);

      const results = await searchCatalog('lion');

      // 'lion' matches 'Lion Knights Castle' (set-10305) and 'Lion Knight' minifig (fig-cas565)
      const expectedIds = seedCatalog
        .filter((item) =>
          [item.number, item.name, item.theme, item.type, item.barcode]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes('lion'),
        )
        .map((item) => item.id);

      expect(results.map((item) => item.id)).toEqual(expectedIds);
    });

    it('should return an empty array when no seed or external items match', async () => {
      (searchRebrickable as any).mockResolvedValueOnce([]);

      const results = await searchCatalog('zzz');

      expect(results).toHaveLength(0);
    });
  });
});
