import { nowIso } from './clock';
import type { LegoItemType, OwnedLegoItem } from '../types/lego';

interface OmgBricksRow {
  setNumber: string;
  setName: string;
  year: number;
  theme: string;
  pieces: number;
  minifigures: number;
  quantity: number;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function detectType(row: OmgBricksRow): LegoItemType {
  if (row.theme === 'Collectable Minifigures' && row.minifigures === 1 && row.pieces > 0 && row.pieces <= 20) {
    return 'minifig';
  }
  return 'set';
}

function generateId(row: OmgBricksRow, type: LegoItemType, hasDuplicate: boolean): string {
  const prefix = type === 'minifig' ? 'fig' : 'set';
  if (hasDuplicate || type === 'minifig') {
    return `${prefix}-${row.setNumber}-${slugify(row.setName)}`;
  }
  return `${prefix}-${row.setNumber}`;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

export function parseOmgBricksCSV(csvText: string): OwnedLegoItem[] {
  const lines = csvText.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const rows: OmgBricksRow[] = lines.slice(1).map((line) => {
    const f = parseCSVLine(line);
    return {
      setNumber: f[0]?.trim() ?? '',
      setName: f[1]?.trim() ?? '',
      year: parseInt(f[2]?.trim() ?? '0', 10) || 0,
      theme: f[3]?.trim() ?? '',
      pieces: parseInt(f[5]?.trim() ?? '0', 10) || 0,
      minifigures: parseInt(f[6]?.trim() ?? '0', 10) || 0,
      quantity: Math.max(1, parseInt(f[7]?.trim() ?? '1', 10) || 1),
    };
  }).filter((r) => r.setNumber);

  const numberCounts = new Map<string, number>();
  for (const row of rows) {
    numberCounts.set(row.setNumber, (numberCounts.get(row.setNumber) ?? 0) + 1);
  }

  const now = nowIso();

  return rows.map((row) => {
    const type = detectType(row);
    const hasDuplicate = (numberCounts.get(row.setNumber) ?? 0) > 1;
    const id = generateId(row, type, hasDuplicate);

    return {
      id,
      type,
      number: row.setNumber,
      name: row.setName,
      theme: row.theme,
      year: row.year,
      pieceCount: row.pieces,
      retired: false,
      estimatedValue: 0,
      imageUrl: '',
      status: 'collection',
      acquiredQuality: 'new',
      savedBox: true,
      buildStatus: 'not-started',
      displayLocation: '',
      notes: '',
      missingParts: '',
      missingPartsList: [],
      quantity: row.quantity,
      addedAt: now,
      updatedAt: now,
    } satisfies OwnedLegoItem;
  });
}
