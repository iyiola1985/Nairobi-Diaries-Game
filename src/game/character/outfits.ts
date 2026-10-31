import type { CharacterConfig } from './types';

export interface Outfit {
  id: string;
  label: string;
  note: string;
  clothing: CharacterConfig['clothing'];
  shoes: CharacterConfig['shoes'];
  accessories?: Partial<CharacterConfig['accessories']>;
}

/** Original closet combinations. They change clothes only, not name, face, or skin. */
export const OUTFITS: Outfit[] = [
  {
    id: 'commute',
    label: 'Commute',
    note: 'Shirt, trousers, loafers',
    clothing: { top: 'oxford', topColor: '#f4f1ea', outer: 'none', outerColor: '#1c1a17', bottom: 'trousers', bottomColor: '#1e2a44', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'loafers', color: '#2a2118' },
  },
  {
    id: 'denim',
    label: 'Denim layer',
    note: 'Tee, denim jacket, jeans',
    clothing: { top: 'tee', topColor: '#f4f1ea', outer: 'denim-jacket', outerColor: '#3d5f86', bottom: 'jeans', bottomColor: '#1e2a44', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'sneakers', color: '#f4f1ea' },
  },
  {
    id: 'market',
    label: 'Market day',
    note: 'Blouse, pleated skirt, sandals, tote',
    clothing: { top: 'blouse', topColor: '#e4d3bc', outer: 'none', outerColor: '#6e2e3c', bottom: 'pleated-skirt', bottomColor: '#6e2e3c', dress: 'none', dressColor: '#6e2e3c' },
    shoes: { style: 'sandals', color: '#c6a15b' },
    accessories: { bag: 'tote', bagColor: '#6e4a32', earrings: true },
  },
  {
    id: 'office',
    label: 'Office',
    note: 'Shirt, blazer, trousers',
    clothing: { top: 'oxford', topColor: '#f4f1ea', outer: 'blazer', outerColor: '#1c1a17', bottom: 'trousers', bottomColor: '#243044', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'loafers', color: '#1c1a17' },
    accessories: { watch: true },
  },
  {
    id: 'hoodie-run',
    label: 'Hoodie run',
    note: 'Tank, hoodie, shorts, trainers',
    clothing: { top: 'tank', topColor: '#1c1a17', outer: 'hoodie', outerColor: '#5d6b45', bottom: 'shorts', bottomColor: '#1c1a17', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'trainers', color: '#f4f1ea' },
  },
  {
    id: 'bomber',
    label: 'Weekend bomber',
    note: 'Tee, bomber, chinos, cap',
    clothing: { top: 'tee', topColor: '#b85a3d', outer: 'bomber', outerColor: '#1e3a32', bottom: 'chinos', bottomColor: '#e4d3bc', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'sneakers', color: '#1c1a17' },
    accessories: { headwear: 'cap', headwearColor: '#1e3a32' },
  },
  {
    id: 'cargo',
    label: 'Cargo boots',
    note: 'Tee, cargo trousers, boots',
    clothing: { top: 'tee', topColor: '#8a8680', outer: 'none', outerColor: '#1c1a17', bottom: 'cargo', bottomColor: '#5d6b45', dress: 'none', dressColor: '#1c1a17' },
    shoes: { style: 'boots', color: '#2a2118' },
  },
  {
    id: 'print-day',
    label: 'Print occasion',
    note: 'Geometric print dress and heels',
    clothing: { top: 'blouse', topColor: '#f4f1ea', outer: 'none', outerColor: '#1c1a17', bottom: 'skirt', bottomColor: '#6e2e3c', dress: 'print-dress', dressColor: '#6e2e3c' },
    shoes: { style: 'heels', color: '#c6a15b' },
    accessories: { earrings: true, bag: 'crossbody', bagColor: '#6e2e3c' },
  },
  {
    id: 'evening',
    label: 'Evening',
    note: 'Long dress and heels',
    clothing: { top: 'blouse', topColor: '#1c1a17', outer: 'none', outerColor: '#1c1a17', bottom: 'trousers', bottomColor: '#1c1a17', dress: 'evening', dressColor: '#1c1a17' },
    shoes: { style: 'heels', color: '#c6a15b' },
    accessories: { earrings: true, chain: true },
  },
  {
    id: 'shirt-dress',
    label: 'Shirt dress',
    note: 'Shirt dress and loafers',
    clothing: { top: 'oxford', topColor: '#f4f1ea', outer: 'none', outerColor: '#1c1a17', bottom: 'trousers', bottomColor: '#1e2a44', dress: 'shirt-dress', dressColor: '#e4d3bc' },
    shoes: { style: 'loafers', color: '#6e4a32' },
  },
];

export function wearOutfit(character: CharacterConfig, outfit: Outfit): CharacterConfig {
  return {
    ...character,
    clothing: { ...outfit.clothing },
    shoes: { ...outfit.shoes },
    accessories: outfit.accessories ? { ...character.accessories, ...outfit.accessories } : character.accessories,
  };
}

export type ExtraSlot = 'jacket' | 'dress' | 'hat' | 'bag' | 'glasses' | 'earrings' | 'chain' | 'watch';

export function takeOff(character: CharacterConfig, slot: ExtraSlot): CharacterConfig {
  switch (slot) {
    case 'jacket':
      return { ...character, clothing: { ...character.clothing, outer: 'none' } };
    case 'dress':
      return { ...character, clothing: { ...character.clothing, dress: 'none' } };
    case 'hat':
      return { ...character, accessories: { ...character.accessories, headwear: 'none' } };
    case 'bag':
      return { ...character, accessories: { ...character.accessories, bag: 'none' } };
    case 'glasses':
      return { ...character, accessories: { ...character.accessories, glasses: false } };
    case 'earrings':
      return { ...character, accessories: { ...character.accessories, earrings: false } };
    case 'chain':
      return { ...character, accessories: { ...character.accessories, chain: false } };
    case 'watch':
      return { ...character, accessories: { ...character.accessories, watch: false } };
    default: {
      const _exhaustive: never = slot;
      return _exhaustive;
    }
  }
}

export function takeOffExtras(character: CharacterConfig): CharacterConfig {
  return {
    ...character,
    clothing: { ...character.clothing, outer: 'none', dress: 'none' },
    accessories: {
      ...character.accessories,
      headwear: 'none',
      bag: 'none',
      glasses: false,
      earrings: false,
      chain: false,
      watch: false,
    },
  };
}
