import type { SetPart } from '../types/lego';

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
