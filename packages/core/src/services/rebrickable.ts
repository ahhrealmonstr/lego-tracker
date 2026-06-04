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

export class RebrickableError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'RebrickableError';
  }
}

export class RateLimitError extends RebrickableError {
  constructor(message: string, public retryAfter?: number) {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

async function fetchFromRebrickable<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  const { rebrickableApiKey } = getConfig();
  if (!rebrickableApiKey) {
    return null;
  }

  const searchParams = new URLSearchParams({
    ...params,
    key: rebrickableApiKey,
  });

  try {
    const response = await fetch(`${BASE_URL}${endpoint}?${searchParams.toString()}`);
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError('Rebrickable API rate limit exceeded', retryAfter ? parseInt(retryAfter, 10) : undefined);
    }
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    console.error('Rebrickable fetch error:', error);
    return null;
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

  try {
    const [sets, minifigs] = await Promise.all([
      fetchFromRebrickable<RebrickableResponse>('/sets/', { search: query, page_size: '10' }),
      fetchFromRebrickable<RebrickableResponse>('/minifigs/', { search: query, page_size: '5' }),
    ]);

    return [
      ...(sets?.results || []).map(s => mapToCatalogItem(s, 'set')),
      ...(minifigs?.results || []).map(m => mapToCatalogItem(m, 'minifig')),
    ];
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    return [];
  }
}

export async function findRebrickableByBarcode(barcode: string): Promise<LegoCatalogItem | null> {
  const cleanedBarcode = barcode.trim();
  
  try {
    // Try sets first
    const setResults = await fetchFromRebrickable<RebrickableResponse>('/sets/', { barcode: cleanedBarcode });
    if (setResults && setResults.results && setResults.results.length > 0) {
      return mapToCatalogItem(setResults.results[0], 'set');
    }

    // Fallback to minifigs
    const minifigResults = await fetchFromRebrickable<RebrickableResponse>('/minifigs/', { barcode: cleanedBarcode });
    if (minifigResults && minifigResults.results && minifigResults.results.length > 0) {
      return mapToCatalogItem(minifigResults.results[0], 'minifig');
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
  }

  return null;
}

interface RebrickableInventorySetsResponse {
  results: Array<{ set_num: string; name: string }>;
}

export async function fetchSetInventorySets(setNum: string): Promise<string[]> {
  const result = await fetchFromRebrickable<RebrickableInventorySetsResponse>(
    `/sets/${setNum}/sets/`,
    {}
  );
  return result?.results.map(s => s.set_num) ?? [];
}

export async function findRebrickableItem(number: string, type: LegoItemType): Promise<LegoCatalogItem | null> {
  const endpoint = type === 'set' ? `/sets/${number}/` : `/minifigs/${number}/`;
  
  try {
    const item = await fetchFromRebrickable<RebrickableItem>(endpoint, {});
    return item ? mapToCatalogItem(item, type) : null;
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    return null;
  }
}
