import React, { useEffect, useMemo, useState } from 'react';
import {
  Barcode,
  Box,
  Check,
  Download,
  Heart,
  LayoutGrid,
  Library,
  PackageCheck,
  Search,
} from 'lucide-react';
import {
  CollectionStatus,
  LegoCatalogItem,
  OwnedLegoItem,
  collectionToCSV,
  collectionToJSON,
  createOwnedItem,
  downloadBlob,
  findByBarcode,
  searchCatalog,
  seedCatalog,
  setConfig,
  summarizeCollection,
  upsertOwnedItem,
} from '@lego-tracker/core';
import { loadCollection, saveCollection } from '../services/storage';
import { enqueueMutation } from '../services/syncQueue';
import { BarcodeScanner } from '../components/BarcodeScanner';
import { ItemList } from '../components/ItemList';
import { DetailPanel } from '../components/DetailPanel';
import { Stat } from '../components/Stat';
import { SyncStatus } from '../components/SyncStatus';
import { useSync } from '../hooks/useSync';

// Initialize core config
setConfig({
  rebrickableApiKey: import.meta.env.VITE_REBRICKABLE_API_KEY,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export type ViewMode = 'collection' | 'wishlist' | 'catalog';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export function App() {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OwnedLegoItem[]>(() => loadCollection());
  const [activeView, setActiveView] = useState<ViewMode>('catalog');
  const [selectedItemId, setSelectedItemId] = useState<string>(seedCatalog[0]?.id ?? '');
  const [detailVisible, setDetailVisible] = useState(false);
  const [catalogResults, setCatalogResults] = useState<LegoCatalogItem[]>(seedCatalog);
  const [isSearching, setIsSearching] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);

  const { status: syncStatus, triggerSync } = useSync();

  useEffect(() => {
    saveCollection(items);
  }, [items]);

  useEffect(() => {
    const handler = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchCatalog(query);
        setCatalogResults(results);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [query]);

  const summary = useMemo(() => summarizeCollection(items), [items]);
  const selectedOwnedItem = items.find((item) => item.id === selectedItemId);
  const selectedCatalogItem = catalogResults.find((item) => item.id === selectedItemId);
  const selectedItem = selectedOwnedItem ?? selectedCatalogItem;
  const visibleOwnedItems = items.filter((item) => item.status === activeView);

  function addItem(item: LegoCatalogItem, status: CollectionStatus) {
    const ownedItem = createOwnedItem(item, status);
    setItems((currentItems) => upsertOwnedItem(currentItems, ownedItem));
    enqueueMutation({ type: 'upsert', item: ownedItem });
    setSelectedItemId(item.id);
    setActiveView(status);
  }

  function updateSelectedItem(patch: Partial<OwnedLegoItem>) {
    if (!selectedOwnedItem) return;
    const updatedItem = { ...selectedOwnedItem, ...patch, updatedAt: new Date().toISOString() };
    setItems((currentItems) => upsertOwnedItem(currentItems, updatedItem));
    enqueueMutation({ type: 'upsert', item: updatedItem });
  }

  function removeSelectedItem() {
    if (!selectedOwnedItem) return;
    setItems((currentItems) => currentItems.filter((item) => item.id !== selectedOwnedItem.id));
    enqueueMutation({ type: 'delete', itemId: selectedOwnedItem.id, deletedAt: new Date().toISOString() });
    setActiveView('catalog');
  }

  async function handleBarcode(barcode: string) {
    if (!barcode.trim() || isScanningBarcode) return;

    setIsScanningBarcode(true);
    setScanMessage(`Searching for ${barcode}...`);

    try {
      const match = await findByBarcode(barcode);
      if (!match) {
        setQuery(barcode);
        setScanMessage(`Barcode ${barcode} not found in catalog. Search filled.`);
        return;
      }

      setScannerOpen(false);
      setScanMessage(`Found ${match.name}`);
      addItem(match, 'collection');
    } catch {
      setScanMessage(`Error searching for barcode ${barcode}.`);
    } finally {
      setIsScanningBarcode(false);
    }
  }

  return (
    <main className="app-shell" data-detail={detailVisible ? 'open' : 'closed'}>
      <section className="sidebar">
        <div className="brand-row">
          <div className="brand-mark">
            <Box size={24} />
          </div>
          <div>
            <h1>Brick Ledger</h1>
            <p>Collection tracker</p>
          </div>
        </div>

        <div className="summary-grid">
          <Stat label="Owned" value={summary.collectionCount.toString()} icon={<Library size={18} />} />
          <Stat label="Wishlist" value={summary.wishlistCount.toString()} icon={<Heart size={18} />} />
          <Stat label="Value" value={formatCurrency(summary.totalEstimatedValue)} icon={<PackageCheck size={18} />} />
          <Stat label="Built" value={summary.completeBuilds.toString()} icon={<Check size={18} />} />
        </div>

        <div className="export-actions">
          <button className="text-button" type="button" onClick={() => downloadBlob(collectionToJSON(items), 'lego-collection.json', 'application/json')}>
            <Download size={14} /> JSON
          </button>
          <button className="text-button" type="button" onClick={() => downloadBlob(collectionToCSV(items), 'lego-collection.csv', 'text/csv')}>
            <Download size={14} /> CSV
          </button>
        </div>

        <SyncStatus status={syncStatus} onRetry={triggerSync} />

        <div className="toolbar">
          <label className="search-box">
            <Search size={18} className={isSearching ? 'spinning' : ''} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search set..." />
          </label>
          <button className="icon-button" type="button" onClick={() => setScannerOpen(true)}>
            <Barcode size={20} />
          </button>
        </div>

        {scanMessage ? <p className="scan-message">{scanMessage}</p> : null}

        <nav className="tabs">
          <button className={activeView === 'catalog' ? 'active' : ''} onClick={() => setActiveView('catalog')}><LayoutGrid size={16} /> Catalog</button>
          <button className={activeView === 'collection' ? 'active' : ''} onClick={() => setActiveView('collection')}><Library size={16} /> Collection</button>
          <button className={activeView === 'wishlist' ? 'active' : ''} onClick={() => setActiveView('wishlist')}><Heart size={16} /> Wishlist</button>
        </nav>

        <ItemList
          activeView={activeView}
          catalogItems={catalogResults}
          ownedItems={visibleOwnedItems}
          selectedItemId={selectedItem?.id}
          onSelect={(id) => { setSelectedItemId(id); setDetailVisible(true); }}
          onAdd={addItem}
        />
      </section>

      <DetailPanel
        item={selectedItem}
        ownedItem={selectedOwnedItem}
        onAdd={addItem}
        onUpdate={updateSelectedItem}
        onRemove={removeSelectedItem}
        onBack={() => setDetailVisible(false)}
      />

      {scannerOpen ? (
        <BarcodeScanner
          isScanning={isScanningBarcode}
          onClose={() => setScannerOpen(false)}
          onDetected={handleBarcode}
          statusMessage={scanMessage}
        />
      ) : null}
    </main>
  );
}
