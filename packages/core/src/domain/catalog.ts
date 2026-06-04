import type { LegoCatalogItem, LegoItemType, SetPart } from '../types/lego';
import { searchRebrickable, findRebrickableItem, findRebrickableByBarcode, fetchSetInventorySets, fetchPartsForInventory } from '../services/rebrickable';
import { getCachedItem, cacheCatalogItem, getCachedItemByBarcode, getSetParts, cacheSetParts } from '../services/supabase';

export const seedCatalog: LegoCatalogItem[] = [
  {
    id: 'set-10305',
    type: 'set',
    number: '10305',
    name: 'Lion Knights Castle',
    theme: 'Icons',
    year: 2022,
    pieceCount: 4514,
    retired: false,
    estimatedValue: 399.99,
    imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
    barcode: '673419357562',
  },
  {
    id: 'set-21318',
    type: 'set',
    number: '21318',
    name: 'Tree House',
    theme: 'Ideas',
    year: 2019,
    pieceCount: 3036,
    retired: true,
    estimatedValue: 235,
    imageUrl: 'https://images.brickset.com/sets/images/21318-1.jpg',
    barcode: '673419313957',
  },
  {
    id: 'set-75313',
    type: 'set',
    number: '75313',
    name: 'AT-AT',
    theme: 'Star Wars',
    year: 2021,
    pieceCount: 6785,
    retired: false,
    estimatedValue: 849.99,
    imageUrl: 'https://images.brickset.com/sets/images/75313-1.jpg',
    barcode: '673419340625',
  },
  {
    id: 'set-10294',
    type: 'set',
    number: '10294',
    name: 'Titanic',
    theme: 'Icons',
    year: 2021,
    pieceCount: 9090,
    retired: false,
    estimatedValue: 679.99,
    imageUrl: 'https://images.brickset.com/sets/images/10294-1.jpg',
    barcode: '673419340892',
  },
  {
    id: 'fig-sw0001c',
    type: 'minifig',
    number: 'sw0001c',
    name: 'Battle Droid Tan with Back Plate',
    theme: 'Star Wars',
    year: 1999,
    pieceCount: 6,
    retired: true,
    estimatedValue: 4.5,
    imageUrl: 'https://img.bricklink.com/ItemImage/MN/0/sw0001c.png',
  },
  {
    id: 'fig-cas565',
    type: 'minifig',
    number: 'cas565',
    name: 'Lion Knight, Flat Silver Helmet',
    theme: 'Castle',
    year: 2022,
    pieceCount: 5,
    retired: false,
    estimatedValue: 8,
    imageUrl: 'https://img.bricklink.com/ItemImage/MN/0/cas565.png',
  },
];

export async function searchCatalog(query: string): Promise<LegoCatalogItem[]> {
  const normalized = query.trim().toLowerCase();
  
  // Local filtered items
  const localResults = seedCatalog.filter((item) => {
    const searchable = [item.number, item.name, item.theme, item.type, item.barcode].filter(Boolean).join(' ').toLowerCase();
    return !normalized || searchable.includes(normalized);
  });

  if (!normalized || normalized.length < 3) {
    return localResults;
  }

  // Fetch from external API
  const externalResults = await searchRebrickable(normalized);

  // Cache results in the background
  externalResults.forEach(item => cacheCatalogItem(item));

  // Combine results, preferring local matches if IDs collide
  const combined = [...localResults];
  const localIds = new Set(localResults.map(item => item.id));

  for (const item of externalResults) {
    if (!localIds.has(item.id)) {
      combined.push(item);
    }
  }

  return combined;
}

export async function findCatalogItem(id: string): Promise<LegoCatalogItem | undefined> {
  const local = seedCatalog.find((item) => item.id === id);
  if (local) return local;

  // Check cache
  const cached = await getCachedItem(id);
  if (cached) return cached;

  // If not in seed or cache, try to fetch from Rebrickable
  const parts = id.split('-');
  if (parts.length === 2) {
    const type = parts[0];
    if (type === 'set' || type === 'minifig') {
      const number = parts[1];
      const item = await findRebrickableItem(number, type as LegoItemType);
      if (item) {
        await cacheCatalogItem(item);
        return item;
      }
    }
  }

  return undefined;
}

export async function findByBarcode(barcode: string): Promise<LegoCatalogItem | undefined> {
  const cleaned = barcode.trim();

  // 1. Check seed catalog
  const local = seedCatalog.find((item) => item.barcode === cleaned);
  if (local) return local;

  // 2. Check cache
  const cached = await getCachedItemByBarcode(cleaned);
  if (cached) return cached;

  // 3. Check Rebrickable
  const external = await findRebrickableByBarcode(cleaned);
  if (external) {
    // 4. Cache it in the background (fire and forget)
    cacheCatalogItem(external).catch((err) => {
      console.error('Failed to background cache item:', err);
    });
    return external;
  }
  return undefined;
}

export async function getOrFetchSetParts(item: LegoCatalogItem): Promise<SetPart[]> {
  if (item.type !== 'set') return [];

  try {
    const cached = await getSetParts(item.id);
    if (cached.length > 0) return cached;

    // Rebrickable requires variant suffix (e.g. "10305-1"); seed catalog items omit it
    const rebrickableNum = item.number.includes('-') ? item.number : `${item.number}-1`;

    const bagSetNums = await fetchSetInventorySets(rebrickableNum);
    let parts: SetPart[];

    if (bagSetNums.length > 0) {
      const perBag = await Promise.all(
        bagSetNums.map((bagSetNum, i) => fetchPartsForInventory(bagSetNum, i + 1))
      );
      parts = perBag.flat();
    } else {
      parts = await fetchPartsForInventory(rebrickableNum, null);
    }

    cacheSetParts(item.id, parts).catch(() => {});
    return parts;
  } catch {
    return [];
  }
}
