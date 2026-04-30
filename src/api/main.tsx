import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Barcode,
  Box,
  Camera,
  Check,
  Heart,
  LayoutGrid,
  Library,
  MapPin,
  PackageCheck,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { findByBarcode, searchCatalog, seedCatalog } from '../domain/catalog';
import { createOwnedItem, summarizeCollection, upsertOwnedItem } from '../domain/collection';
import { buildStatusLabels, itemTypeLabels, qualityLabels, statusLabels } from '../domain/options';
import { canUseBarcodeDetector, scanVideoFrame } from '../services/barcode';
import { loadCollection, saveCollection } from '../services/storage';
import type { AcquisitionQuality, BuildStatus, CollectionStatus, LegoCatalogItem, OwnedLegoItem } from '../types/lego';
import './styles.css';

type ViewMode = 'collection' | 'wishlist' | 'catalog';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function App() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OwnedLegoItem[]>(() => loadCollection());
  const [activeView, setActiveView] = useState<ViewMode>('catalog');
  const [selectedItemId, setSelectedItemId] = useState<string>(seedCatalog[0]?.id ?? '');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');

  useEffect(() => {
    saveCollection(items);
  }, [items]);

  const summary = useMemo(() => summarizeCollection(items), [items]);
  const selectedOwnedItem = items.find((item) => item.id === selectedItemId);
  const selectedCatalogItem = seedCatalog.find((item) => item.id === selectedItemId);
  const selectedItem = selectedOwnedItem ?? selectedCatalogItem ?? seedCatalog[0];
  const filteredCatalog = useMemo(() => searchCatalog(query), [query]);
  const visibleOwnedItems = items.filter((item) => item.status === activeView);

  function addItem(item: LegoCatalogItem, status: CollectionStatus) {
    const ownedItem = createOwnedItem(item, status);
    setItems((currentItems) => upsertOwnedItem(currentItems, ownedItem));
    setSelectedItemId(item.id);
    setActiveView(status);
  }

  function updateSelectedItem(patch: Partial<OwnedLegoItem>) {
    if (!selectedOwnedItem) {
      return;
    }

    setItems((currentItems) => upsertOwnedItem(currentItems, { ...selectedOwnedItem, ...patch }));
  }

  function removeSelectedItem() {
    if (!selectedOwnedItem) {
      return;
    }

    setItems((currentItems) => currentItems.filter((item) => item.id !== selectedOwnedItem.id));
    setActiveView('catalog');
  }

  function handleBarcode(barcode: string) {
    const match = findByBarcode(barcode);
    if (!match) {
      setQuery(barcode);
      setScanMessage(`No seeded match for ${barcode}. Search is filled so you can add it manually later.`);
      return;
    }

    setScannerOpen(false);
    setScanMessage(`Found ${match.name}`);
    addItem(match, 'collection');
  }

  return (
    <main className="app-shell">
      <section className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Box size={24} />
          </div>
          <div>
            <h1>Brick Ledger</h1>
            <p>Collection and wishlist tracker</p>
          </div>
        </div>

        <div className="summary-grid">
          <Stat label="Owned" value={summary.collectionCount.toString()} icon={<Library size={18} />} />
          <Stat label="Wishlist" value={summary.wishlistCount.toString()} icon={<Heart size={18} />} />
          <Stat label="Value" value={formatCurrency(summary.totalEstimatedValue)} icon={<PackageCheck size={18} />} />
          <Stat label="Built" value={summary.completeBuilds.toString()} icon={<Check size={18} />} />
        </div>

        <div className="toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search set number, theme, keyword"
            />
          </label>
          <button className="icon-button" type="button" title="Scan barcode" onClick={() => setScannerOpen(true)}>
            <Barcode size={20} />
          </button>
        </div>

        {scanMessage ? <p className="scan-message">{scanMessage}</p> : null}

        <nav className="tabs" aria-label="Collection views">
          <button className={activeView === 'catalog' ? 'active' : ''} type="button" onClick={() => setActiveView('catalog')}>
            <LayoutGrid size={16} /> Catalog
          </button>
          <button className={activeView === 'collection' ? 'active' : ''} type="button" onClick={() => setActiveView('collection')}>
            <Library size={16} /> Collection
          </button>
          <button className={activeView === 'wishlist' ? 'active' : ''} type="button" onClick={() => setActiveView('wishlist')}>
            <Heart size={16} /> Wishlist
          </button>
        </nav>

        <ItemList
          activeView={activeView}
          catalogItems={filteredCatalog}
          ownedItems={visibleOwnedItems}
          selectedItemId={selectedItem?.id}
          onSelect={setSelectedItemId}
          onAdd={addItem}
        />
      </section>

      <DetailPanel
        item={selectedItem}
        ownedItem={selectedOwnedItem}
        onAdd={addItem}
        onUpdate={updateSelectedItem}
        onRemove={removeSelectedItem}
      />

      {scannerOpen ? <BarcodeScanner onClose={() => setScannerOpen(false)} onDetected={handleBarcode} /> : null}
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="stat">
      <span>{icon}</span>
      <div>
        <strong>{value}</strong>
        <small>{label}</small>
      </div>
    </div>
  );
}

function ItemList({
  activeView,
  catalogItems,
  ownedItems,
  selectedItemId,
  onSelect,
  onAdd,
}: {
  activeView: ViewMode;
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

function DetailPanel({
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
            <button type="button" onClick={() => onAdd(item, 'collection')}>
              <Plus size={18} /> Add to collection
            </button>
            <button type="button" className="secondary" onClick={() => onAdd(item, 'wishlist')}>
              <Heart size={18} /> Add to wishlist
            </button>
          </div>
        </div>
      </div>

      {ownedItem ? (
        <form className="detail-form">
          <Field label="List">
            <select value={ownedItem.status} onChange={(event) => onUpdate({ status: event.target.value as CollectionStatus })}>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Set quality when bought">
            <select
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
            <select value={ownedItem.buildStatus} onChange={(event) => onUpdate({ buildStatus: event.target.value as BuildStatus })}>
              {Object.entries(buildStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Display location">
            <input
              value={ownedItem.displayLocation}
              onChange={(event) => onUpdate({ displayLocation: event.target.value })}
              placeholder="Office shelf, living room, storage bin"
            />
          </Field>
          <Field label="Quantity">
            <input
              min="1"
              type="number"
              value={ownedItem.quantity}
              onChange={(event) => onUpdate({ quantity: Math.max(1, Number(event.target.value)) })}
            />
          </Field>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={ownedItem.savedBox}
              onChange={(event) => onUpdate({ savedBox: event.target.checked })}
            />
            Box saved
          </label>
          <Field label="Missing parts">
            <textarea
              value={ownedItem.missingParts}
              onChange={(event) => onUpdate({ missingParts: event.target.value })}
              placeholder="List part IDs, colors, or notes"
            />
          </Field>
          <Field label="Notes">
            <textarea value={ownedItem.notes} onChange={(event) => onUpdate({ notes: event.target.value })} />
          </Field>
          <button className="danger" type="button" onClick={onRemove}>
            Remove from lists
          </button>
        </form>
      ) : (
        <div className="not-owned">
          <MapPin size={18} />
          Add this item to track condition, box status, build progress, display location, and missing parts.
        </div>
      )}
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

function BarcodeScanner({ onClose, onDetected }: { onClose: () => void; onDetected: (barcode: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [message, setMessage] = useState(
    canUseBarcodeDetector() ? 'Point the camera at a barcode.' : 'Camera barcode detection is not supported in this browser.'
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    let active = true;
    let frameId = 0;

    async function start() {
      if (!canUseBarcodeDetector()) {
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (!videoRef.current) {
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        const tick = async () => {
          if (!active || !videoRef.current) {
            return;
          }

          const code = await scanVideoFrame(videoRef.current);
          if (code) {
            onDetected(code);
            return;
          }

          frameId = window.setTimeout(tick, 350);
        };

        tick();
      } catch {
        setMessage('Camera permission failed. Enter the barcode manually.');
      }
    }

    start();

    return () => {
      active = false;
      window.clearTimeout(frameId);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [onDetected]);

  return (
    <div className="modal-backdrop">
      <section className="scanner-modal">
        <div className="modal-heading">
          <h2>Scan barcode</h2>
          <button className="icon-button" type="button" title="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="scanner-frame">
          <video ref={videoRef} muted playsInline />
          <Camera size={34} />
        </div>
        <p>{message}</p>
        <div className="manual-barcode">
          <input value={manualCode} onChange={(event) => setManualCode(event.target.value)} placeholder="Enter barcode" />
          <button type="button" onClick={() => onDetected(manualCode)}>
            Search
          </button>
        </div>
      </section>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
