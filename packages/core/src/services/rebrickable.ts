import type { LegoCatalogItem, LegoItemType } from '../types/lego';
import { getConfig } from '../config';

const BASE_URL = 'https://rebrickable.com/api/v3/lego';

interface RebrickableItem {
  set_num: string;
  name: string;
  year: number;
  theme_id: number;
  num_parts: number;
  set_img_url: string;
}

interface RebrickableResponse {
  results: RebrickableItem[];
}

async function fetchFromRebrickable(endpoint: string, params: Record<string, string>): Promise<RebrickableItem[]> {
  const { rebrickableApiKey } = getConfig();
  if (!rebrickableApiKey) {
    return [];
  }

  const searchParams = new URLSearchParams({
    ...params,
    key: rebrickableApiKey,
  });

  try {
    const response = await fetch(`${BASE_URL}${endpoint}?${searchParams.toString()}`);
    if (response.status === 429) {
      console.warn('Rebrickable API rate limit exceeded');
      return [];
    }
    if (!response.ok) {
      return [];
    }
    const data: RebrickableResponse = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('Rebrickable fetch error:', error);
    return [];
  }
}

function mapToCatalogItem(item: RebrickableItem, type: LegoItemType): LegoCatalogItem {
  return {
    id: `${type}-${item.set_num}`,
    type,
    number: item.set_num,
    name: item.name,
    theme: `Theme ${item.theme_id}`,
    year: item.year || 0,
    pieceCount: item.num_parts || 0,
    retired: false,
    estimatedValue: 0,
    imageUrl: item.set_img_url || 'https://via.placeholder.com/150?text=No+Image',
  };
}

export async function searchRebrickable(query: string): Promise<LegoCatalogItem[]> {
  if (!query || query.length < 3) {
    return [];
  }

  const [sets, minifigs] = await Promise.all([
    fetchFromRebrickable('/sets/', { search: query, page_size: '10' }),
    fetchFromRebrickable('/minifigs/', { search: query, page_size: '5' }),
  ]);

  return [
    ...sets.map(s => mapToCatalogItem(s, 'set')),
    ...minifigs.map(m => mapToCatalogItem(m, 'minifig')),
  ];
}

export async function findRebrickableByBarcode(barcode: string): Promise<LegoCatalogItem | null> {
  const results = await fetchFromRebrickable('/sets/', { barcode: barcode.trim() });
  if (results && results.length > 0) {
    return mapToCatalogItem(results[0], 'set');
  }
  return null;
}

export async function findRebrickableItem(number: string, type: LegoItemType): Promise<LegoCatalogItem | null> {
  const { rebrickableApiKey } = getConfig();
  if (!rebrickableApiKey) return null;

  const endpoint = type === 'set' ? `/sets/${number}/` : `/minifigs/${number}/`;
  const url = `${BASE_URL}${endpoint}?key=${rebrickableApiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const item: RebrickableItem = await response.json();
    return mapToCatalogItem(item, type);
  } catch {
    return null;
  }
}
