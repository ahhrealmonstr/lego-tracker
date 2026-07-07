import type { SetPart } from '../types/lego';

// Maps Rebrickable/BrickLink colour names → LDraw colour IDs.
// Source: https://www.ldraw.org/article/547.html
// Only the most common colours are listed; unknown colours fall back to 16 (current colour).
const LDRAW_COLOUR_MAP: Record<string, number> = {
  'White': 15, 'Black': 0, 'Blue': 1, 'Green': 2, 'Dark Turquoise': 107,
  'Red': 4, 'Dark Red': 59, 'Brown': 6, 'Light Gray': 7, 'Dark Gray': 8,
  'Light Blue': 212, 'Bright Green': 37, 'Light Green': 10, 'Tan': 19,
  'Violet': 89, 'Orange': 25, 'Magenta': 26, 'Lime': 76, 'Medium Lime': 76,
  'Yellow': 14, 'Light Yellow': 226, 'Aqua': 152, 'Light Aqua': 152,
  'Dark Tan': 28, 'Sand Green': 151, 'Sand Blue': 135, 'Dark Blue': 272,
  'Dark Green': 288, 'Medium Blue': 102, 'Medium Azure': 156, 'Coral': 220,
  'Dark Azure': 321, 'Lavender': 315, 'Light Purple': 324, 'Dark Purple': 268,
  'Dark Pink': 47, 'Medium Lavender': 325, 'Pink': 23, 'Light Flesh': 283,
  'Medium Nougat': 312, 'Nougat': 18, 'Dark Orange': 68, 'Pearl Gold': 297,
  'Flat Silver': 179, 'Pearl Light Gray': 135, 'Trans-Clear': 47,
  'Trans-Red': 36, 'Trans-Blue': 43, 'Trans-Yellow': 46, 'Trans-Green': 35,
  'Trans-Dark Blue': 272, 'Trans-Orange': 57, 'Trans-Purple': 51,
};

function csvEscape(value: string): string {
  // Neutralize formula injection (Excel/Sheets treat leading =+-@ as formulas)
  let v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (v.includes(',') || v.includes('"') || v.includes('\n') || v.includes('\r')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function partsToCSV(parts: SetPart[]): string {
  if (parts.length === 0) return '';
  const header = 'DesignNumber,ColorName,Quantity';
  const rows = parts.map(p => `${csvEscape(p.partNum)},${csvEscape(p.colorName)},${p.quantity}`);
  return [header, ...rows].join('\n');
}

export function partsToLDR(parts: SetPart[], modelName = 'LEGO Set'): string {
  const lines: string[] = [
    `0 ${modelName}`,
    `0 !LDRAW_ORG Unofficial_Model`,
    `0 !LICENSE Redistributable under CCAL version 2.0`,
    '',
  ];

  // LDraw identity rotation — flat XZ plane, stacked by quantity along Y axis (8 LDU per plate)
  const ROT = '1 0 0 0 1 0 0 0 1';
  const PLATE_H = 8;  // 1 plate = 8 LDraw units tall
  const STUD = 20;    // 1 stud = 20 LDraw units wide

  let col = 0;
  let yOffset = 0;

  for (const part of parts) {
    const colour = LDRAW_COLOUR_MAP[part.colorName] ?? 16;
    const x = col * STUD;
    // Stack multiples vertically so duplicates don't overlap
    for (let i = 0; i < part.quantity; i++) {
      lines.push(`1 ${colour} ${x} ${yOffset + i * PLATE_H} 0 ${ROT} 3024.dat`);
    }
    col++;
    yOffset = 0;
  }

  lines.push('');
  lines.push(`0 // ${parts.length} unique parts, ${parts.reduce((s, p) => s + p.quantity, 0)} total pieces`);

  return lines.join('\r\n');
}

export function partsToBSX(parts: SetPart[]): string {
  const items = parts.map(p => `    <Item>
      <ItemType>P</ItemType>
      <ItemID>${xmlEscape(p.partNum)}</ItemID>
      <ColorName>${xmlEscape(p.colorName)}</ColorName>
      <Qty>${p.quantity}</Qty>
      <Condition>N</Condition>
    </Item>`).join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<BrickStockXML>
  <Inventory>
${items}
  </Inventory>
</BrickStockXML>`;
}
