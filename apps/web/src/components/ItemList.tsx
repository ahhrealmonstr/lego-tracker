import React from 'react';
import { Plus } from 'lucide-react';
import { CollectionStatus, LegoCatalogItem, OwnedLegoItem, itemTypeLabels } from '@lego-tracker/core';

export function ItemList({
  activeView,
  catalogItems,
  ownedItems,
  selectedItemId,
  onSelect,
  onAdd,
}: {
  activeView: string;
  catalogItems: LegoCatalogItem[];
  ownedItems: OwnedLegoItem[];
  selectedItemId?: string;
  onSelect: (id: string) => void;
  onAdd: (item: LegoCatalogItem, status: CollectionStatus) => void;
}) {
  const listItems = activeView === 'catalog' ? catalogItems : ownedItems;

  if (listItems.length === 0) {
    return <div className="empty-state">No matching items yet.</div>;
  }

  return (
    <div className="item-list">
      {listItems.map((item) => (
        <article
          key={item.id}
          className={selectedItemId === item.id ? 'item-row selected' : 'item-row'}
          onClick={() => onSelect(item.id)}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onSelect(item.id); }}
        >
          <img src={item.imageUrl} alt="" />
          <div>
            <div className="item-title-line">
              <strong>{item.number}</strong>
              <span>{itemTypeLabels[item.type]}</span>
            </div>
            <p>{item.name}</p>
            <small>{item.theme}</small>
          </div>
          {activeView === 'catalog' ? (
            <button
              className="mini-action"
              type="button"
              title="Add to collection"
              onClick={(event) => {
                event.stopPropagation();
                onAdd(item, 'collection');
              }}
            >
              <Plus size={16} />
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
