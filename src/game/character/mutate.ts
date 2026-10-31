import { BLUSH_COLORS, BODY_STARTS, BROW_COLORS, CLOTH_COLORS, EYE_COLORS, EYESHADOW_COLORS, HAIR_COLORS, HAIR_STYLES, LIP_COLORS, SKIN_TONES } from './catalog';
import { createDefaultCharacter } from './presets';
import type {
  BottomStyle,
  CharacterConfig,
  CreatorTab,
  DressStyle,
  FacialHairStyle,
  HairStyle,
  OuterStyle,
  Presentation,
  ShoeStyle,
  TopStyle,
} from './types';

const PRESENTATION: Presentation[] = ['feminine', 'androgynous', 'masculine'];
const TOPS: TopStyle[] = ['tee', 'polo', 'oxford', 'blouse', 'knit', 'tank'];
const OUTERS: OuterStyle[] = ['none', 'hoodie', 'denim-jacket', 'blazer', 'bomber', 'print-jacket'];
const BOTTOMS: BottomStyle[] = ['jeans', 'chinos', 'trousers', 'shorts', 'cargo', 'skirt', 'pleated-skirt'];
const DRESSES: DressStyle[] = ['none', 'shirt-dress', 'print-dress', 'evening'];
const SHOES: ShoeStyle[] = ['sneakers', 'loafers', 'heels', 'sandals', 'boots', 'trainers'];
const FACIAL: FacialHairStyle[] = ['none', 'stubble', 'moustache', 'goatee', 'full-beard'];

function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

function unit(rng: () => number): number {
  return Math.round(rng() * 100) / 100;
}

export function randomizeCharacter(config: CharacterConfig, rng: () => number = Math.random): CharacterConfig {
  const next: CharacterConfig = {
    ...config,
    presentation: pick(PRESENTATION, rng),
    skin: pick(SKIN_TONES, rng).hex,
    body: { height: unit(rng), build: unit(rng), shoulder: unit(rng), hip: unit(rng) },
    face: {
      shape: unit(rng),
      jaw: unit(rng),
      cheeks: unit(rng),
      forehead: unit(rng),
      chin: unit(rng),
      eyeSize: unit(rng),
      eyeSpacing: unit(rng),
      eyeColor: pick(EYE_COLORS, rng).hex,
      brow: unit(rng),
      noseWidth: unit(rng),
      noseLength: unit(rng),
      lipFullness: unit(rng),
    },
    hair: { style: pick(HAIR_STYLES, rng).id as HairStyle, color: pick(HAIR_COLORS, rng).hex },
    facialHair: { style: pick(FACIAL, rng), color: pick(HAIR_COLORS, rng).hex },
    makeup: {
      lipstick: pick(LIP_COLORS, rng).hex,
      eyeliner: unit(rng),
      lashes: unit(rng),
      foundation: unit(rng),
      eyeshadow: pick(EYESHADOW_COLORS, rng).hex,
      blush: pick(BLUSH_COLORS, rng).hex,
      browColor: pick(BROW_COLORS, rng).hex,
    },
    nails: { style: pick(['natural', 'colour', 'long'] as const, rng), color: pick(LIP_COLORS, rng).hex ?? '#c9899a' },
    clothing: {
      top: pick(TOPS, rng),
      topColor: pick(CLOTH_COLORS, rng).hex,
      outer: pick(OUTERS, rng),
      outerColor: pick(CLOTH_COLORS, rng).hex,
      bottom: pick(BOTTOMS, rng),
      bottomColor: pick(CLOTH_COLORS, rng).hex,
      dress: rng() > 0.72 ? pick(DRESSES.filter((item) => item !== 'none'), rng) : 'none',
      dressColor: pick(CLOTH_COLORS, rng).hex,
    },
    shoes: { style: pick(SHOES, rng), color: pick(CLOTH_COLORS, rng).hex },
    accessories: {
      ...config.accessories,
      headwear: pick(['none', 'cap', 'beret', 'bucket', 'brim', 'kufi'] as const, rng),
      glasses: rng() > 0.7,
      earrings: rng() > 0.5,
      chain: rng() > 0.6,
      watch: rng() > 0.4,
    },
  };
  return next;
}

export function randomizeCategory(config: CharacterConfig, tab: CreatorTab, rng: () => number = Math.random): CharacterConfig {
  const full = randomizeCharacter(config, rng);
  const next = structuredClone(config);
  switch (tab) {
    case 'appearance':
      next.presentation = full.presentation;
      next.skin = full.skin;
      break;
    case 'face':
      next.face = full.face;
      next.makeup = full.makeup;
      break;
    case 'hair':
      next.hair = full.hair;
      next.facialHair = full.facialHair;
      break;
    case 'body':
      next.body = full.body;
      break;
    case 'clothing':
      next.clothing = full.clothing;
      break;
    case 'shoes':
      next.shoes = full.shoes;
      break;
    case 'accessories':
      next.accessories = full.accessories;
      next.nails = full.nails;
      break;
    case 'final':
      return full;
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
  return next;
}

export function resetCategory(config: CharacterConfig, tab: CreatorTab): CharacterConfig {
  const base = createDefaultCharacter();
  const next = structuredClone(config);
  switch (tab) {
    case 'appearance':
      next.presentation = base.presentation;
      next.skin = base.skin;
      break;
    case 'face':
      next.face = structuredClone(base.face);
      next.makeup = structuredClone(base.makeup);
      break;
    case 'hair':
      next.hair = structuredClone(base.hair);
      next.facialHair = structuredClone(base.facialHair);
      break;
    case 'body':
      next.body = structuredClone(base.body);
      break;
    case 'clothing':
      next.clothing = structuredClone(base.clothing);
      break;
    case 'shoes':
      next.shoes = structuredClone(base.shoes);
      break;
    case 'accessories':
      next.accessories = structuredClone(base.accessories);
      next.nails = structuredClone(base.nails);
      break;
    case 'final':
      return {
        ...base,
        displayName: config.displayName,
        username: config.username,
        confirmed: config.confirmed,
        lifestyle: config.lifestyle,
      };
    default: {
      const _exhaustive: never = tab;
      return _exhaustive;
    }
  }
  return next;
}

export function cycleBody(config: CharacterConfig, direction: 1 | -1): CharacterConfig {
  const current = BODY_STARTS.findIndex(
    (item) =>
      Math.abs(item.height - config.body.height) < 0.02 &&
      Math.abs(item.build - config.body.build) < 0.02 &&
      Math.abs(item.shoulder - config.body.shoulder) < 0.02,
  );
  const index = current === -1 ? 0 : (current + direction + BODY_STARTS.length) % BODY_STARTS.length;
  const next = BODY_STARTS[index];
  return {
    ...config,
    body: { height: next.height, build: next.build, shoulder: next.shoulder, hip: next.hip },
  };
}

export function nextIndex(index: number, count: number, direction: 1 | -1): number {
  return (index + direction + count) % count;
}
