// apps/web/src/components/PartsList.tsx
import React from 'react';
import { type LegoCatalogItem, type SetPart } from '@lego-tracker/core';
import { useSetParts } from '../hooks/useSetParts';

export function PartsList({ item }: { item: LegoCatalogItem }) {
  const { parts, loading, error } = useSetParts(item);

  if (loading) {
    return <div className="parts-loading" data-testid="parts-loading">Loading parts…</div>;
  }
  if (error) {
    return <div className="parts-error" data-testid="parts-error">Couldn't load parts</div>;
  }
  if (parts.length === 0) return null;

  const nonSpares = parts.filter(p => !p.isSpare);
  const spares = parts.filter(p => p.isSpare);
  const hasNamedBags = nonSpares.some(p => p.bagNum !== null);

  const byBag = nonSpares.reduce<Record<string, SetPart[]>>((acc, part) => {
    const key = part.bagNum !== null ? String(part.bagNum) : 'all';
    (acc[key] ??= []).push(part);
    return acc;
  }, {});

  return (
    <section className="parts-list" data-testid="parts-list">
      <h3 className="parts-heading">Parts</h3>
      {hasNamedBags ? (
        Object.entries(byBag)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([bagKey, bagParts]) => (
            <details key={bagKey} className="parts-bag">
              <summary>Bag {bagKey} <span className="parts-count">({bagParts.length})</span></summary>
              <div className="parts-grid">
                {bagParts.map(p => (
                  <PartCard key={`${p.partNum}-${p.colorName}`} part={p} />
                ))}
              </div>
            </details>
          ))
      ) : (
        <>
          <p className="parts-count">{nonSpares.length} parts</p>
          <div className="parts-grid">
            {nonSpares.map(p => (
              <PartCard key={`${p.partNum}-${p.colorName}`} part={p} />
            ))}
          </div>
        </>
      )}
      {spares.length > 0 && (
        <details className="parts-bag parts-spares">
          <summary>Spare parts <span className="parts-count">({spares.length})</span></summary>
          <div className="parts-grid">
            {spares.map(p => (
              <PartCard key={`${p.partNum}-${p.colorName}`} part={p} />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function PartCard({ part }: { part: SetPart }) {
  return (
    <div className="part-card" data-testid="part-card">
      <img
        src={part.imgUrl}
        alt={part.partName}
        className="part-img"
        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
      />
      <span className="part-num">{part.partNum}</span>
      <span className="part-color">{part.colorName}</span>
      <span className="part-qty">×{part.quantity}</span>
    </div>
  );
}
