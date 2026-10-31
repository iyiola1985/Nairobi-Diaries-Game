import { faceTone, naturalLip } from './metrics';
import type { CharacterConfig, ShoeStyle } from './types';

export interface DerivedLook {
  skin: string;
  face: string;
  lip: string;
  eye: string;
  hair: string;
  facialHair: CharacterConfig['facialHair']['style'];
  sleeve: 'none' | 'short' | 'long';
  sleeveColor: string;
  torsoColor: string;
  torsoPattern: boolean;
  trouser: 'none' | 'short' | 'full';
  trouserColor: string;
  skirt: 'none' | 'short' | 'knee' | 'ankle';
  skirtColor: string;
  skirtPattern: boolean;
  hood: boolean;
  collar: boolean;
  cargo: boolean;
  bulk: number;
  shoe: ShoeStyle;
  shoeColor: string;
  shoeLift: number;
}

export function shoeLift(style: ShoeStyle): number {
  switch (style) {
    case 'heels':
      return 0.07;
    case 'boots':
      return 0.025;
    case 'sneakers':
    case 'trainers':
      return 0.02;
    case 'loafers':
    case 'sandals':
      return 0.012;
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

export function deriveLook(config: CharacterConfig): DerivedLook {
  const { clothing } = config;
  const dress = clothing.dress;
  const full = dress === 'evening' || dress === 'print-dress';
  const outerOn = clothing.outer !== 'none' && !full;
  const bottom = clothing.bottom;

  let trouser: DerivedLook['trouser'] = 'none';
  if (dress === 'none' && bottom !== 'skirt' && bottom !== 'pleated-skirt') {
    trouser = bottom === 'shorts' ? 'short' : 'full';
  }

  let skirt: DerivedLook['skirt'] = 'none';
  if (dress === 'evening') skirt = 'ankle';
  else if (dress === 'print-dress' || dress === 'shirt-dress' || bottom === 'pleated-skirt') skirt = 'knee';
  else if (bottom === 'skirt') skirt = 'short';

  let sleeve: DerivedLook['sleeve'] = 'none';
  let sleeveColor = clothing.topColor;
  if (full) {
    sleeve = dress === 'evening' ? 'long' : 'short';
    sleeveColor = clothing.dressColor;
  } else if (outerOn) {
    sleeve = 'long';
    sleeveColor = clothing.outerColor;
  } else if (dress === 'shirt-dress') {
    sleeve = 'long';
    sleeveColor = clothing.dressColor;
  } else if (clothing.top === 'tank') {
    sleeve = 'none';
  } else if (clothing.top === 'tee' || clothing.top === 'polo') {
    sleeve = 'short';
  } else {
    sleeve = 'long';
  }

  let torsoColor = clothing.topColor;
  if (outerOn) torsoColor = clothing.outerColor;
  else if (dress !== 'none') torsoColor = clothing.dressColor;

  let bulk = 1;
  if (outerOn && (clothing.outer === 'hoodie' || clothing.outer === 'bomber')) bulk = 1.1;
  else if (!outerOn && clothing.top === 'knit' && dress === 'none') bulk = 1.16;
  else if (outerOn && clothing.outer === 'blazer') bulk = 1.06;

  return {
    skin: config.skin,
    face: faceTone(config.skin, config.makeup.foundation),
    lip: config.makeup.lipstick ?? naturalLip(config.skin),
    eye: config.face.eyeColor,
    hair: config.hair.color,
    facialHair: config.facialHair.style,
    sleeve,
    sleeveColor,
    torsoColor,
    torsoPattern: (outerOn && clothing.outer === 'print-jacket') || (!outerOn && dress === 'print-dress'),
    trouser,
    trouserColor: clothing.bottomColor,
    skirt,
    skirtColor: dress !== 'none' ? clothing.dressColor : clothing.bottomColor,
    skirtPattern: dress === 'print-dress',
    hood: outerOn && clothing.outer === 'hoodie',
    collar: !outerOn && (dress === 'shirt-dress' || (dress === 'none' && (clothing.top === 'oxford' || clothing.top === 'polo' || clothing.top === 'blouse'))),
    cargo: trouser !== 'none' && bottom === 'cargo',
    bulk,
    shoe: config.shoes.style,
    shoeColor: config.shoes.color,
    shoeLift: shoeLift(config.shoes.style),
  };
}
