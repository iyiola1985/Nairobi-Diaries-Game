import type { CharacterConfig } from './types';

const baseFace = {
  shape: 0.5,
  jaw: 0.5,
  cheeks: 0.45,
  forehead: 0.5,
  chin: 0.5,
  eyeSize: 0.5,
  eyeSpacing: 0.5,
  eyeColor: '#3a2418',
  brow: 0.5,
  noseWidth: 0.5,
  noseLength: 0.5,
  lipFullness: 0.55,
};

const baseMakeup = {
  lipstick: null,
  eyeliner: 0.1,
  lashes: 0.15,
  foundation: 0.5,
  eyeshadow: null,
  blush: null,
  browColor: '#2a211c',
};

export function completeCharacter(character: CharacterConfig): CharacterConfig {
  return {
    ...character,
    makeup: { ...baseMakeup, ...character.makeup },
  };
}

function blank(patch: Partial<CharacterConfig> & Pick<CharacterConfig, 'presentation' | 'displayName'>): CharacterConfig {
  return {
    version: 1,
    confirmed: false,
    displayName: patch.displayName,
    username: patch.username ?? '',
    presentation: patch.presentation,
    skin: patch.skin ?? '#6e4a32',
    body: patch.body ?? { height: 0.5, build: 0.5, shoulder: 0.5, hip: 0.5 },
    face: patch.face ?? { ...baseFace },
    hair: patch.hair ?? { style: 'short-fade', color: '#1a120f' },
    facialHair: patch.facialHair ?? { style: 'none', color: '#1a120f' },
    makeup: patch.makeup ?? { ...baseMakeup },
    nails: patch.nails ?? { style: 'natural', color: '#c9899a' },
    clothing: patch.clothing ?? {
      top: 'oxford',
      topColor: '#f4f1ea',
      outer: 'none',
      outerColor: '#1c1a17',
      bottom: 'trousers',
      bottomColor: '#1e2a44',
      dress: 'none',
      dressColor: '#1c1a17',
    },
    shoes: patch.shoes ?? { style: 'loafers', color: '#1c1a17' },
    accessories: patch.accessories ?? {
      headwear: 'none',
      headwearColor: '#1c1a17',
      bag: 'none',
      bagColor: '#6e4a32',
      glasses: false,
      earrings: false,
      chain: false,
      watch: true,
    },
    lifestyle: patch.lifestyle ?? { neighbourhood: 'cbd', focus: 'work' },
  };
}

export interface StylePreset {
  id: string;
  label: string;
  detail: string;
  config: Omit<CharacterConfig, 'displayName' | 'username' | 'confirmed' | 'lifestyle'>;
}

function presetBody(config: CharacterConfig): StylePreset['config'] {
  return {
    version: config.version,
    presentation: config.presentation,
    skin: config.skin,
    body: config.body,
    face: config.face,
    hair: config.hair,
    facialHair: config.facialHair,
    makeup: config.makeup,
    nails: config.nails,
    clothing: config.clothing,
    shoes: config.shoes,
    accessories: config.accessories,
  };
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: 'cbd-commute',
    label: 'CBD commute',
    detail: 'Shirt, trousers, loafers',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'androgynous',
        skin: '#5c3b28',
        hair: { style: 'short-fade', color: '#1a120f' },
        clothing: {
          top: 'oxford',
          topColor: '#f4f1ea',
          outer: 'none',
          outerColor: '#1c1a17',
          bottom: 'trousers',
          bottomColor: '#243044',
          dress: 'none',
          dressColor: '#1c1a17',
        },
        shoes: { style: 'loafers', color: '#2a2118' },
        accessories: {
          headwear: 'none',
          headwearColor: '#1c1a17',
          bag: 'crossbody',
          bagColor: '#6e4a32',
          glasses: false,
          earrings: false,
          chain: false,
          watch: true,
        },
      }),
    ),
  },
  {
    id: 'westlands-night',
    label: 'Westlands night',
    detail: 'Black tee, bomber, chain',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'masculine',
        skin: '#3b2418',
        body: { height: 0.62, build: 0.58, shoulder: 0.7, hip: 0.48 },
        face: { ...baseFace, jaw: 0.72, noseWidth: 0.58 },
        hair: { style: 'waves', color: '#1a120f' },
        facialHair: { style: 'stubble', color: '#1a120f' },
        clothing: {
          top: 'tee',
          topColor: '#111111',
          outer: 'bomber',
          outerColor: '#1c1a17',
          bottom: 'jeans',
          bottomColor: '#24344a',
          dress: 'none',
          dressColor: '#111111',
        },
        shoes: { style: 'sneakers', color: '#f4f1ea' },
        accessories: {
          headwear: 'none',
          headwearColor: '#111111',
          bag: 'none',
          bagColor: '#111111',
          glasses: false,
          earrings: true,
          chain: true,
          watch: true,
        },
      }),
    ),
  },
  {
    id: 'kilimani-brunch',
    label: 'Kilimani brunch',
    detail: 'Blouse, skirt, heels',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'feminine',
        skin: '#81583a',
        body: { height: 0.58, build: 0.4, shoulder: 0.42, hip: 0.66 },
        face: { ...baseFace, cheeks: 0.62, lipFullness: 0.7, eyeSize: 0.62 },
        hair: { style: 'bob', color: '#3a2418' },
        makeup: { ...baseMakeup, lipstick: '#a84858', eyeliner: 0.45, lashes: 0.55, foundation: 0.55, blush: '#d4898f' },
        nails: { style: 'colour', color: '#a84858' },
        clothing: {
          top: 'blouse',
          topColor: '#f4f1ea',
          outer: 'none',
          outerColor: '#f4f1ea',
          bottom: 'skirt',
          bottomColor: '#1e3a32',
          dress: 'none',
          dressColor: '#1e3a32',
        },
        shoes: { style: 'heels', color: '#1c1a17' },
        accessories: {
          headwear: 'none',
          headwearColor: '#1c1a17',
          bag: 'tote',
          bagColor: '#e4d3bc',
          glasses: false,
          earrings: true,
          chain: false,
          watch: false,
        },
      }),
    ),
  },
  {
    id: 'karen-weekend',
    label: 'Karen weekend',
    detail: 'Polo and chinos',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'masculine',
        skin: '#967052',
        hair: { style: 'buzz', color: '#1a120f' },
        facialHair: { style: 'none', color: '#1a120f' },
        clothing: {
          top: 'polo',
          topColor: '#1e3a32',
          outer: 'none',
          outerColor: '#1e3a32',
          bottom: 'chinos',
          bottomColor: '#e4d3bc',
          dress: 'none',
          dressColor: '#1e3a32',
        },
        shoes: { style: 'loafers', color: '#6e4a32' },
      }),
    ),
  },
  {
    id: 'street-layers',
    label: 'Street layers',
    detail: 'Hoodie, cargos, cap',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'androgynous',
        skin: '#4a2e1e',
        hair: { style: 'twists', color: '#1a120f' },
        clothing: {
          top: 'tee',
          topColor: '#f4f1ea',
          outer: 'hoodie',
          outerColor: '#5d6b45',
          bottom: 'cargo',
          bottomColor: '#3d3428',
          dress: 'none',
          dressColor: '#5d6b45',
        },
        shoes: { style: 'trainers', color: '#c6a15b' },
        accessories: {
          headwear: 'cap',
          headwearColor: '#1c1a17',
          bag: 'backpack',
          bagColor: '#1c1a17',
          glasses: false,
          earrings: false,
          chain: false,
          watch: false,
        },
      }),
    ),
  },
  {
    id: 'evening',
    label: 'Date night',
    detail: 'Evening dress or sharp tailoring',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'feminine',
        skin: '#6e4a32',
        body: { height: 0.7, build: 0.42, shoulder: 0.4, hip: 0.64 },
        face: { ...baseFace, lipFullness: 0.72, eyeSize: 0.6 },
        hair: { style: 'long-coils', color: '#1a120f' },
        makeup: { ...baseMakeup, lipstick: '#9a2e32', eyeliner: 0.7, lashes: 0.75, foundation: 0.52, eyeshadow: '#6d3d55' },
        nails: { style: 'long', color: '#9a2e32' },
        clothing: {
          top: 'blouse',
          topColor: '#111111',
          outer: 'none',
          outerColor: '#111111',
          bottom: 'trousers',
          bottomColor: '#111111',
          dress: 'evening',
          dressColor: '#111111',
        },
        shoes: { style: 'heels', color: '#c6a15b' },
        accessories: {
          headwear: 'none',
          headwearColor: '#111111',
          bag: 'none',
          bagColor: '#111111',
          glasses: false,
          earrings: true,
          chain: true,
          watch: false,
        },
      }),
    ),
  },
  {
    id: 'gym',
    label: 'Gym',
    detail: 'Tank, shorts, trainers',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'androgynous',
        skin: '#81583a',
        body: { height: 0.66, build: 0.7, shoulder: 0.74, hip: 0.5 },
        hair: { style: 'cornrows', color: '#1a120f' },
        clothing: {
          top: 'tank',
          topColor: '#b85a3d',
          outer: 'none',
          outerColor: '#b85a3d',
          bottom: 'shorts',
          bottomColor: '#1c1a17',
          dress: 'none',
          dressColor: '#b85a3d',
        },
        shoes: { style: 'trainers', color: '#f4f1ea' },
        accessories: {
          headwear: 'none',
          headwearColor: '#1c1a17',
          bag: 'none',
          bagColor: '#1c1a17',
          glasses: false,
          earrings: false,
          chain: false,
          watch: true,
        },
      }),
    ),
  },
  {
    id: 'occasion',
    label: 'Occasion',
    detail: 'Geometric print',
    config: presetBody(
      blank({
        displayName: '',
        presentation: 'feminine',
        skin: '#5c3b28',
        hair: { style: 'headwrap', color: '#b85a3d' },
        makeup: { ...baseMakeup, lipstick: '#7a3048', eyeliner: 0.35, lashes: 0.4, foundation: 0.5, eyeshadow: '#7a5340' },
        clothing: {
          top: 'blouse',
          topColor: '#b85a3d',
          outer: 'none',
          outerColor: '#b85a3d',
          bottom: 'skirt',
          bottomColor: '#b85a3d',
          dress: 'print-dress',
          dressColor: '#1e3a32',
        },
        shoes: { style: 'sandals', color: '#c6a15b' },
        accessories: {
          headwear: 'none',
          headwearColor: '#b85a3d',
          bag: 'none',
          bagColor: '#c6a15b',
          glasses: false,
          earrings: true,
          chain: true,
          watch: false,
        },
      }),
    ),
  },
];

export function createDefaultCharacter(): CharacterConfig {
  return applyPreset(
    blank({
      displayName: '',
      username: '',
      presentation: 'androgynous',
    }),
    'cbd-commute',
  );
}

export function applyPreset(current: CharacterConfig, presetId: string): CharacterConfig {
  const preset = STYLE_PRESETS.find((item) => item.id === presetId) ?? STYLE_PRESETS[0];
  return {
    ...current,
    ...preset.config,
    displayName: current.displayName,
    username: current.username,
    confirmed: current.confirmed,
    lifestyle: current.lifestyle,
    version: 1,
  };
}
