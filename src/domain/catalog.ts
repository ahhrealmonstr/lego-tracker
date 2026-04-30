import type { LegoCatalogItem } from '../types/lego';

export const seedCatalog: LegoCatalogItem[] = [
  {
    id: 'set-10305',
    type: 'set',
    number: '10305',
    name: 'Lion Knights Castle',
    theme: 'Icons',
    year: 2022,
    pieceCount: 4514,
    retired: false,
    estimatedValue: 399.99,
    imageUrl: 'https://images.brickset.com/sets/images/10305-1.jpg',
    barcode: '673419357562',
  },
  {
    id: 'set-21318',
    type: 'set',
    number: '21318',
    name: 'Tree House',
    theme: 'Ideas',
    year: 2019,
    pieceCount: 3036,
    retired: true,
    estimatedValue: 235,
    imageUrl: 'https://images.brickset.com/sets/images/21318-1.jpg',
    barcode: '673419313957',
  },
  {
    id: 'set-75313',
    type: 'set',
    number: '75313',
    name: 'AT-AT',
    theme: 'Star Wars',
    year: 2021,
    pieceCount: 6785,
    retired: false,
    estimatedValue: 849.99,
    imageUrl: 'https://images.brickset.com/sets/images/75313-1.jpg',
    barcode: '673419340625',
  },
  {
    id: 'set-10294',
    type: 'set',
    number: '10294',
    name: 'Titanic',
    theme: 'Icons',
    year: 2021,
    pieceCount: 9090,
    retired: false,
    estimatedValue: 679.99,
    imageUrl: 'https://images.brickset.com/sets/images/10294-1.jpg',
    barcode: '673419340892',
  },
  {
    id: 'fig-sw0001c',
    type: 'minifig',
    number: 'sw0001c',
    name: 'Battle Droid Tan with Back Plate',
    theme: 'Star Wars',
    year: 1999,
    pieceCount: 6,
    retired: true,
    estimatedValue: 4.5,
    imageUrl: 'https://img.bricklink.com/ItemImage/MN/0/sw0001c.png',
  },
  {
    id: 'fig-cas565',
    type: 'minifig',
    number: 'cas565',
    name: 'Lion Knight, Flat Silver Helmet',
    theme: 'Castle',
    year: 2022,
    pieceCount: 5,
    retired: false,
    estimatedValue: 8,
    imageUrl: 'https://img.bricklink.com/ItemImage/MN/0/cas565.png',
  },
];

export function searchCatalog(query: string): LegoCatalogItem[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return seedCatalog;
  }

  return seedCatalog.filter((item) => {
    const searchable = [item.number, item.name, item.theme, item.type, item.barcode].filter(Boolean).join(' ').toLowerCase();
    return searchable.includes(normalized);
  });
}

export function findCatalogItem(id: string): LegoCatalogItem | undefined {
  return seedCatalog.find((item) => item.id === id);
}

export function findByBarcode(barcode: string): LegoCatalogItem | undefined {
  return seedCatalog.find((item) => item.barcode === barcode.trim());
}
