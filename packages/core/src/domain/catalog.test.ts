import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findByBarcode, seedCatalog } from './catalog';
import { getCachedItemByBarcode, cacheCatalogItem } from '../services/supabase';
import { findRebrickableByBarcode } from '../services/rebrickable';

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
});
