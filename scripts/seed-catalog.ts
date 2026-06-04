import https from 'node:https';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SETS_URL = 'https://cdn.rebrickable.com/media/downloads/sets.csv.gz';
const THEMES_URL = 'https://cdn.rebrickable.com/media/downloads/themes.csv.gz';
const PLACEHOLDER_IMG = 'https://via.placeholder.com/150?text=No+Image';

interface SetCsvRow {
  set_num: string;
  name: string;
  year: string;
  theme_id: string;
  num_parts: string;
  set_img_url: string;
}

export interface CatalogRow {
  id: string;
  type: 'set';
  number: string;
  name: string;
  theme: string;
  year: number;
  piece_count: number;
  retired: boolean;
  estimated_value: number;
  image_url: string;
  barcode: null;
}

export function parseThemes(csv: string): Map<string, string> {
  const records = parse(csv, { columns: true, skip_empty_lines: true }) as Array<{
    id: string;
    name: string;
  }>;
  return new Map(records.map((r) => [r.id, r.name]));
}

export function mapSetRow(row: SetCsvRow, themeMap: Map<string, string>): CatalogRow | null {
  const year = parseInt(row.year, 10);
  if (year < 1932) return null;
  return {
    id: `set-${row.set_num}`,
    type: 'set',
    number: row.set_num,
    name: row.name,
    theme: themeMap.get(row.theme_id) ?? `Theme ${row.theme_id}`,
    year,
    piece_count: parseInt(row.num_parts, 10) || 0,
    retired: false,
    estimated_value: 0,
    image_url: row.set_img_url || PLACEHOLDER_IMG,
    barcode: null,
  };
}

export function parseSets(csv: string, themeMap: Map<string, string>): CatalogRow[] {
  const records = parse(csv, { columns: true, skip_empty_lines: true }) as SetCsvRow[];
  return records.flatMap((r) => {
    const row = mapSetRow(r, themeMap);
    return row ? [row] : [];
  });
}

export function fetchGzippedCsv(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        const gunzip = zlib.createGunzip();
        const chunks: Buffer[] = [];
        res.pipe(gunzip);
        gunzip.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        gunzip.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        gunzip.on('error', reject);
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

export async function upsertCatalog(
  rows: CatalogRow[],
  client: SupabaseClient,
): Promise<number> {
  const BATCH = 1000;
  let count = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await client
      .from('catalog_cache')
      .upsert(batch, { onConflict: 'id' });
    if (error) throw new Error(error.message);
    count += batch.length;
  }
  return count;
}

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      'Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in .env',
    );
    process.exit(1);
  }

  const client = createClient(supabaseUrl, serviceRoleKey);
  const start = Date.now();

  console.log('Fetching themes...');
  const themesCsv = await fetchGzippedCsv(THEMES_URL);
  const themeMap = parseThemes(themesCsv);
  console.log(`  Loaded ${themeMap.size} themes`);

  console.log('Fetching sets...');
  const setsCsv = await fetchGzippedCsv(SETS_URL);
  const rows = parseSets(setsCsv, themeMap);
  console.log(`  Parsed ${rows.length} sets`);

  console.log('Upserting to Supabase...');
  const count = await upsertCatalog(rows, client);
  console.log(`✓ ${count} sets upserted (${Date.now() - start}ms)`);
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
