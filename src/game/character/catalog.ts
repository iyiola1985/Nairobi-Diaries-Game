import type {
  BagStyle,
  BottomStyle,
  DressStyle,
  FacialHairStyle,
  HairStyle,
  HeadwearStyle,
  LifestyleFocus,
  NailStyle,
  Neighbourhood,
  OuterStyle,
  Presentation,
  ShoeStyle,
  TopStyle,
} from './types';

export interface CatalogItem<T extends string> {
  id: T;
  label: string;
  note?: string;
}

export const PRESENTATIONS: CatalogItem<Presentation>[] = [
  { id: 'feminine', label: 'Feminine' },
  { id: 'androgynous', label: 'Androgynous' },
  { id: 'masculine', label: 'Masculine' },
];

export const SKIN_TONES = [
  { id: 'deep-1', label: 'Deep 1', hex: '#2c1b14' },
  { id: 'deep-2', label: 'Deep 2', hex: '#3b2418' },
  { id: 'deep-3', label: 'Deep 3', hex: '#4a2e1e' },
  { id: 'brown-1', label: 'Brown 1', hex: '#5c3b28' },
  { id: 'brown-2', label: 'Brown 2', hex: '#6e4a32' },
  { id: 'brown-3', label: 'Brown 3', hex: '#81583a' },
  { id: 'bronze-1', label: 'Bronze 1', hex: '#967052' },
  { id: 'bronze-2', label: 'Bronze 2', hex: '#b08b68' },
  { id: 'light-1', label: 'Light 1', hex: '#c9a88a' },
  { id: 'light-2', label: 'Light 2', hex: '#e0c4a8' },
];

export const HAIR_STYLES: CatalogItem<HairStyle>[] = [
  { id: 'afro', label: 'Afro' },
  { id: 'short-fade', label: 'Short fade' },
  { id: 'buzz', label: 'Buzz cut' },
  { id: 'waves', label: 'Waves' },
  { id: 'cornrows', label: 'Cornrows' },
  { id: 'box-braids', label: 'Box braids' },
  { id: 'locs', label: 'Locs' },
  { id: 'twists', label: 'Twists' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'bob', label: 'Bob' },
  { id: 'long-coils', label: 'Long coils' },
  { id: 'headwrap', label: 'Headwrap' },
];

export const HAIR_COLORS = [
  { id: 'black', label: 'Black', hex: '#1a120f' },
  { id: 'dark-brown', label: 'Dark brown', hex: '#3a2418' },
  { id: 'brown', label: 'Brown', hex: '#6b3e2a' },
  { id: 'auburn', label: 'Auburn', hex: '#8a3b24' },
  { id: 'copper', label: 'Copper', hex: '#b85c38' },
  { id: 'honey', label: 'Honey', hex: '#a67c45' },
  { id: 'burgundy', label: 'Burgundy', hex: '#6e2430' },
  { id: 'grey', label: 'Grey', hex: '#8d8882' },
];

export const FACIAL_HAIR: CatalogItem<FacialHairStyle>[] = [
  { id: 'none', label: 'None' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'goatee', label: 'Goatee' },
  { id: 'full-beard', label: 'Full beard' },
];

export const EYE_COLORS = [
  { id: 'dark-brown', label: 'Dark brown', hex: '#3a2418' },
  { id: 'brown', label: 'Brown', hex: '#6b4428' },
  { id: 'amber', label: 'Amber', hex: '#a56a2f' },
  { id: 'hazel', label: 'Hazel', hex: '#7d8a4a' },
  { id: 'green', label: 'Green', hex: '#3f6b4e' },
  { id: 'grey', label: 'Grey', hex: '#7d868e' },
];

export const EYESHADOW_COLORS: { id: string; label: string; hex: string | null }[] = [
  { id: 'none', label: 'No eyeshadow', hex: null },
  { id: 'brown', label: 'Brown', hex: '#7a5340' },
  { id: 'bronze', label: 'Bronze', hex: '#a56b3c' },
  { id: 'plum', label: 'Plum', hex: '#6d3d55' },
  { id: 'rose', label: 'Rose', hex: '#a85b68' },
];

export const BLUSH_COLORS: { id: string; label: string; hex: string | null }[] = [
  { id: 'none', label: 'No blush', hex: null },
  { id: 'warm', label: 'Warm', hex: '#c47a62' },
  { id: 'rose', label: 'Rose', hex: '#d4898f' },
  { id: 'berry', label: 'Berry', hex: '#a24b62' },
];

export const BROW_COLORS = [
  { id: 'black', label: 'Black', hex: '#1a120f' },
  { id: 'dark-brown', label: 'Dark brown', hex: '#3a2418' },
  { id: 'brown', label: 'Brown', hex: '#6b3e2a' },
  { id: 'soft', label: 'Soft brown', hex: '#8a6248' },
];

export const LIP_COLORS: { id: string; label: string; hex: string | null }[] = [
  { id: 'natural', label: 'Natural', hex: null },
  { id: 'rose', label: 'Rose', hex: '#a84858' },
  { id: 'berry', label: 'Berry', hex: '#7a3048' },
  { id: 'nude', label: 'Nude', hex: '#a87868' },
  { id: 'cocoa', label: 'Cocoa', hex: '#6a4034' },
  { id: 'red', label: 'Red', hex: '#9a2e32' },
];

export const TOPS: CatalogItem<TopStyle>[] = [
  { id: 'tee', label: 'T-shirt' },
  { id: 'polo', label: 'Polo' },
  { id: 'oxford', label: 'Shirt' },
  { id: 'blouse', label: 'Blouse' },
  { id: 'knit', label: 'Oversized knit' },
  { id: 'tank', label: 'Tank' },
];

export const OUTERS: CatalogItem<OuterStyle>[] = [
  { id: 'none', label: 'No jacket' },
  { id: 'hoodie', label: 'Hoodie' },
  { id: 'denim-jacket', label: 'Denim jacket' },
  { id: 'blazer', label: 'Blazer' },
  { id: 'bomber', label: 'Bomber' },
  { id: 'print-jacket', label: 'Print jacket', note: 'Geometric print, East African occasion wear' },
];

export const BOTTOMS: CatalogItem<BottomStyle>[] = [
  { id: 'jeans', label: 'Jeans' },
  { id: 'chinos', label: 'Chinos' },
  { id: 'trousers', label: 'Trousers' },
  { id: 'shorts', label: 'Shorts' },
  { id: 'cargo', label: 'Cargo' },
  { id: 'skirt', label: 'Skirt' },
  { id: 'pleated-skirt', label: 'Pleated skirt' },
];

export const DRESSES: CatalogItem<DressStyle>[] = [
  { id: 'none', label: 'Separates' },
  { id: 'shirt-dress', label: 'Shirt dress' },
  { id: 'print-dress', label: 'Print dress', note: 'Geometric print, not a specific textile' },
  { id: 'evening', label: 'Evening dress' },
];

export const SHOES: CatalogItem<ShoeStyle>[] = [
  { id: 'sneakers', label: 'Sneakers' },
  { id: 'trainers', label: 'Trainers' },
  { id: 'loafers', label: 'Loafers' },
  { id: 'heels', label: 'Heels' },
  { id: 'sandals', label: 'Sandals' },
  { id: 'boots', label: 'Boots' },
];

export const HEADWEAR: CatalogItem<HeadwearStyle>[] = [
  { id: 'none', label: 'None' },
  { id: 'cap', label: 'Cap' },
  { id: 'beret', label: 'Beret' },
  { id: 'bucket', label: 'Bucket hat' },
  { id: 'brim', label: 'Brim hat' },
  { id: 'kufi', label: 'Kufi' },
];

export const BAGS: CatalogItem<BagStyle>[] = [
  { id: 'none', label: 'None' },
  { id: 'tote', label: 'Tote' },
  { id: 'crossbody', label: 'Crossbody' },
  { id: 'backpack', label: 'Backpack' },
];

export const NAILS: CatalogItem<NailStyle>[] = [
  { id: 'natural', label: 'Natural' },
  { id: 'colour', label: 'Colour' },
  { id: 'long', label: 'Long' },
];

export const CLOTH_COLORS = [
  { id: 'ink', label: 'Ink', hex: '#1c1a17' },
  { id: 'white', label: 'White', hex: '#f4f1ea' },
  { id: 'sand', label: 'Sand', hex: '#e4d3bc' },
  { id: 'navy', label: 'Navy', hex: '#1e2a44' },
  { id: 'denim', label: 'Denim', hex: '#3d5f86' },
  { id: 'olive', label: 'Olive', hex: '#5d6b45' },
  { id: 'forest', label: 'Forest', hex: '#1e3a32' },
  { id: 'clay', label: 'Clay', hex: '#b85a3d' },
  { id: 'gold', label: 'Brass', hex: '#c6a15b' },
  { id: 'wine', label: 'Wine', hex: '#6e2e3c' },
  { id: 'black', label: 'Black', hex: '#111111' },
  { id: 'grey', label: 'Grey', hex: '#8a8680' },
];

export const NEIGHBOURHOODS: CatalogItem<Neighbourhood>[] = [
  { id: 'cbd', label: 'Nairobi CBD', note: 'Playable in this prototype' },
  { id: 'westlands', label: 'Westlands' },
  { id: 'kilimani', label: 'Kilimani' },
  { id: 'upper-hill', label: 'Upper Hill' },
  { id: 'karen', label: 'Karen' },
  { id: 'lavington', label: 'Lavington' },
  { id: 'parklands', label: 'Parklands' },
  { id: 'eastleigh', label: 'Eastleigh' },
];

export const FOCUSES: CatalogItem<LifestyleFocus>[] = [
  { id: 'work', label: 'Work' },
  { id: 'fashion', label: 'Fashion' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'food', label: 'Food' },
  { id: 'study', label: 'Study' },
  { id: 'fitness', label: 'Fitness' },
];

export const BODY_STARTS = [
  { id: 'compact', label: 'Compact', height: 0.22, build: 0.32, shoulder: 0.4, hip: 0.46 },
  { id: 'balanced', label: 'Balanced', height: 0.5, build: 0.5, shoulder: 0.5, hip: 0.5 },
  { id: 'tall', label: 'Tall', height: 0.86, build: 0.48, shoulder: 0.56, hip: 0.5 },
  { id: 'broad', label: 'Broad', height: 0.62, build: 0.86, shoulder: 0.9, hip: 0.72 },
] as const;

export function labelOf<T extends string>(items: CatalogItem<T>[], id: T): string {
  return items.find((item) => item.id === id)?.label ?? id;
}
