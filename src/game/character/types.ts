export type Presentation = 'masculine' | 'feminine' | 'androgynous';

export type HairStyle =
  | 'afro'
  | 'short-fade'
  | 'buzz'
  | 'waves'
  | 'cornrows'
  | 'box-braids'
  | 'locs'
  | 'twists'
  | 'ponytail'
  | 'bob'
  | 'long-coils'
  | 'headwrap';

export type FacialHairStyle = 'none' | 'stubble' | 'moustache' | 'goatee' | 'full-beard';

export type TopStyle = 'tee' | 'polo' | 'oxford' | 'blouse' | 'tank' | 'knit';

export type OuterStyle = 'none' | 'hoodie' | 'denim-jacket' | 'blazer' | 'bomber' | 'print-jacket';

export type BottomStyle = 'jeans' | 'chinos' | 'trousers' | 'shorts' | 'cargo' | 'skirt' | 'pleated-skirt';

export type DressStyle = 'none' | 'shirt-dress' | 'print-dress' | 'evening';

export type ShoeStyle = 'sneakers' | 'loafers' | 'heels' | 'sandals' | 'boots' | 'trainers';

export type HeadwearStyle = 'none' | 'cap' | 'bucket' | 'brim' | 'beret' | 'kufi';

export type BagStyle = 'none' | 'tote' | 'crossbody' | 'backpack';

export type NailStyle = 'natural' | 'colour' | 'long';

export type Neighbourhood =
  | 'cbd'
  | 'westlands'
  | 'kilimani'
  | 'upper-hill'
  | 'karen'
  | 'lavington'
  | 'parklands'
  | 'eastleigh';

export type LifestyleFocus = 'work' | 'fashion' | 'nightlife' | 'food' | 'study' | 'fitness';

export type CreatorTab = 'appearance' | 'face' | 'hair' | 'body' | 'clothing' | 'shoes' | 'accessories' | 'final';

export interface CharacterConfig {
  version: 1;
  confirmed: boolean;
  displayName: string;
  username: string;
  presentation: Presentation;
  skin: string;
  body: {
    height: number;
    build: number;
    shoulder: number;
    hip: number;
  };
  face: {
    shape: number;
    jaw: number;
    cheeks: number;
    forehead: number;
    chin: number;
    eyeSize: number;
    eyeSpacing: number;
    eyeColor: string;
    brow: number;
    noseWidth: number;
    noseLength: number;
    lipFullness: number;
  };
  hair: {
    style: HairStyle;
    color: string;
  };
  facialHair: {
    style: FacialHairStyle;
    color: string;
  };
  makeup: {
    lipstick: string | null;
    eyeliner: number;
    lashes: number;
    foundation: number;
    eyeshadow: string | null;
    blush: string | null;
    browColor: string;
  };
  nails: {
    style: NailStyle;
    color: string;
  };
  clothing: {
    top: TopStyle;
    topColor: string;
    outer: OuterStyle;
    outerColor: string;
    bottom: BottomStyle;
    bottomColor: string;
    dress: DressStyle;
    dressColor: string;
  };
  shoes: {
    style: ShoeStyle;
    color: string;
  };
  accessories: {
    headwear: HeadwearStyle;
    headwearColor: string;
    bag: BagStyle;
    bagColor: string;
    glasses: boolean;
    earrings: boolean;
    chain: boolean;
    watch: boolean;
  };
  lifestyle: {
    neighbourhood: Neighbourhood;
    focus: LifestyleFocus;
  };
}

export interface SavedLook {
  id: string;
  name: string;
  config: CharacterConfig;
}

export interface BodyMetrics {
  height: number;
  shoulder: number;
  hip: number;
  waist: number;
  chest: number;
}
