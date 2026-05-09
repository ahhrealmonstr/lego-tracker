import type { OwnedLegoItem } from '../types/lego';

export function collectionToJSON(items: OwnedLegoItem[]): string {
  return JSON.stringify(items, null, 2);
}

export function collectionToCSV(items: OwnedLegoItem[]): string {
  if (items.length === 0) {
    return '';
  }

  const headers = [
    'id',
    'type',
    'number',
    'name',
    'theme',
    'year',
    'pieceCount',
    'status',
    'acquiredQuality',
    'buildStatus',
    'displayLocation',
    'quantity',
    'addedAt',
  ];

  const rows = items.map((item) => {
    return headers
      .map((header) => {
        const value = item[header as keyof OwnedLegoItem];
        const stringValue = value === undefined || value === null ? '' : String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      })
      .join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
