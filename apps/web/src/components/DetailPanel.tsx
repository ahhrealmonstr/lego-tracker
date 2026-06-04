import React from 'react';
import { Heart, MapPin, Plus } from 'lucide-react';
import { PartsList } from './PartsList';
import {
  AcquisitionQuality,
  BuildStatus,
  CollectionStatus,
  LegoCatalogItem,
  OwnedLegoItem,
  buildStatusLabels,
  itemTypeLabels,
  qualityLabels,
  statusLabels,
} from '@lego-tracker/core';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function DetailPanel({
  item,
  ownedItem,
  onAdd,
  onUpdate,
  onRemove,
}: {
  item?: LegoCatalogItem;
  ownedItem?: OwnedLegoItem;
  onAdd: (item: LegoCatalogItem, status: CollectionStatus) => void;
  onUpdate: (patch: Partial<OwnedLegoItem>) => void;
  onRemove: () => void;
}) {
  if (!item) {
    return <section className="detail-panel empty-state">Select a set or minifig.</section>;
  }

  return (
    <section className="detail-panel">
      <div className="detail-hero">
        <img src={item.imageUrl} alt={item.name} />
        <div className="detail-heading">
          <div className="kicker">
            {itemTypeLabels[item.type]} {item.number}
          </div>
          <h2>{item.name}</h2>
          <p>
            {item.theme} · {item.year} · {item.pieceCount.toLocaleString()} pieces
          </p>
          <div className="badge-row">
            <span>{formatCurrency(item.estimatedValue)}</span>
            <span>{item.retired ? 'Retired' : 'Active'}</span>
          </div>
          <div className="action-row">
            <button type="button" data-testid="detail-add-to-collection" onClick={() => onAdd(item, 'collection')}>
              <Plus size={18} /> Add to collection
            </button>
            <button type="button" className="secondary" data-testid="detail-add-to-wishlist" onClick={() => onAdd(item, 'wishlist')}>
              <Heart size={18} /> Add to wishlist
            </button>
          </div>
        </div>
      </div>

      {ownedItem ? (
        <form className="detail-form">
          <Field label="List">
            <select data-testid="detail-status-select" value={ownedItem.status} onChange={(event) => onUpdate({ status: event.target.value as CollectionStatus })}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Set quality when bought">
            <select
              data-testid="detail-quality-select"
              value={ownedItem.acquiredQuality}
              onChange={(event) => onUpdate({ acquiredQuality: event.target.value as AcquisitionQuality })}
            >
              {Object.entries(qualityLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Building status">
            <select data-testid="detail-build-status-select" value={ownedItem.buildStatus} onChange={(event) => onUpdate({ buildStatus: event.target.value as BuildStatus })}>
              {Object.entries(buildStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display location">
            <input
              data-testid="detail-display-location"
              value={ownedItem.displayLocation}
              onChange={(event) => onUpdate({ displayLocation: event.target.value })}
              placeholder="Office shelf, living room, storage bin"
            />
          </Field>
          <Field label="Quantity">
            <input
              data-testid="detail-quantity"
              min="1"
              type="number"
              value={ownedItem.quantity}
              onChange={(event) => onUpdate({ quantity: Math.max(1, Number(event.target.value)) })}
            />
          </Field>
          <label className="checkbox-field">
            <input
              data-testid="detail-saved-box"
              type="checkbox"
              checked={ownedItem.savedBox}
              onChange={(event) => onUpdate({ savedBox: event.target.checked })}
            />
            Box saved
          </label>
          <Field label="Missing parts">
            <textarea
              data-testid="detail-missing-parts"
              value={ownedItem.missingParts}
              onChange={(event) => onUpdate({ missingParts: event.target.value })}
              placeholder="List part IDs, colors, or notes"
            />
          </Field>
          <Field label="Notes">
            <textarea data-testid="detail-notes" value={ownedItem.notes} onChange={(event) => onUpdate({ notes: event.target.value })} />
          </Field>
          <button className="danger" type="button" data-testid="detail-remove" onClick={onRemove}>
            Remove from lists
          </button>
        </form>
      ) : (
        <div className="not-owned">
          <MapPin size={18} />
          Add this item to track condition, box status, build progress, display location, and missing parts.
        </div>
      )}

      {item.type === 'set' && <PartsList item={item} />}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
