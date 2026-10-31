import { useState } from 'react';
import {
  BAGS,
  BOTTOMS,
  CLOTH_COLORS,
  DRESSES,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR,
  OUTERS,
  SHOES,
  TOPS,
  labelOf,
} from '../game/character/catalog';
import { OUTFITS, takeOff, takeOffExtras, wearOutfit, type ExtraSlot } from '../game/character/outfits';
import type { CharacterConfig } from '../game/character/types';

type Rack = 'outfits' | 'tops' | 'jackets' | 'bottoms' | 'dresses' | 'shoes' | 'hair' | 'extras';

const RACKS: { id: Rack; label: string }[] = [
  { id: 'outfits', label: 'Outfits' },
  { id: 'tops', label: 'Tops' },
  { id: 'jackets', label: 'Jackets' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'dresses', label: 'Dresses' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'hair', label: 'Hair' },
  { id: 'extras', label: 'Extras' },
];

export function DressingRoom({
  character,
  patch,
}: {
  character: CharacterConfig;
  patch: (next: CharacterConfig) => void;
}) {
  const [rack, setRack] = useState<Rack>('outfits');
  const wearing = wornChips(character);

  return (
    <div className="section dresser">
      <p className="hint">
        Mix pieces on this character before the city, and again from Wardrobe later. The face and name stay. These are original clothes, and nothing here charges real money.
      </p>
      <div className="dresser-layout">
        <div className="dress-nav" role="tablist" aria-label="Closet">
          {RACKS.map((item) => (
            <button
              key={item.id}
              className={rack === item.id ? 'choice on' : 'choice'}
              type="button"
              role="tab"
              aria-selected={rack === item.id}
              onClick={() => setRack(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div>
          <RackPanel rack={rack} character={character} patch={patch} />
        </div>
      </div>
      <h2>Wearing</h2>
      <div className="choices">
        {wearing.map((chip) => (
          <button key={chip.slot} className="item" type="button" onClick={() => patch(takeOff(character, chip.slot))}>
            {chip.label} · take off
          </button>
        ))}
        <button className="item" type="button" onClick={() => patch(takeOffExtras(character))}>
          Take off extras
        </button>
      </div>
    </div>
  );
}

function wornChips(character: CharacterConfig): { slot: ExtraSlot; label: string }[] {
  const chips: { slot: ExtraSlot; label: string }[] = [];
  if (character.clothing.outer !== 'none') chips.push({ slot: 'jacket', label: labelOf(OUTERS, character.clothing.outer) });
  if (character.clothing.dress !== 'none') chips.push({ slot: 'dress', label: labelOf(DRESSES, character.clothing.dress) });
  if (character.accessories.headwear !== 'none') chips.push({ slot: 'hat', label: labelOf(HEADWEAR, character.accessories.headwear) });
  if (character.accessories.bag !== 'none') chips.push({ slot: 'bag', label: labelOf(BAGS, character.accessories.bag) });
  if (character.accessories.glasses) chips.push({ slot: 'glasses', label: 'Glasses' });
  if (character.accessories.earrings) chips.push({ slot: 'earrings', label: 'Earrings' });
  if (character.accessories.chain) chips.push({ slot: 'chain', label: 'Chain' });
  if (character.accessories.watch) chips.push({ slot: 'watch', label: 'Watch' });
  return chips;
}

function RackPanel({
  rack,
  character,
  patch,
}: {
  rack: Rack;
  character: CharacterConfig;
  patch: (next: CharacterConfig) => void;
}) {
  switch (rack) {
    case 'outfits':
      return (
        <div className="choices">
          {OUTFITS.map((outfit) => (
            <button key={outfit.id} className="dress-card" type="button" onClick={() => patch(wearOutfit(character, outfit))}>
              <strong>{outfit.label}</strong>
              <span>{outfit.note}</span>
            </button>
          ))}
        </div>
      );
    case 'tops':
      return (
        <>
          <PieceRow
            items={TOPS}
            selected={character.clothing.top}
            onPick={(top) => patch({ ...character, clothing: { ...character.clothing, top, dress: 'none' } })}
          />
          <Swatches value={character.clothing.topColor} onPick={(topColor) => patch({ ...character, clothing: { ...character.clothing, topColor } })} />
        </>
      );
    case 'jackets':
      return (
        <>
          <PieceRow
            items={OUTERS}
            selected={character.clothing.outer}
            onPick={(outer) => patch({ ...character, clothing: { ...character.clothing, outer } })}
          />
          <Swatches value={character.clothing.outerColor} onPick={(outerColor) => patch({ ...character, clothing: { ...character.clothing, outerColor } })} />
        </>
      );
    case 'bottoms':
      return (
        <>
          <PieceRow
            items={BOTTOMS}
            selected={character.clothing.bottom}
            onPick={(bottom) => patch({ ...character, clothing: { ...character.clothing, bottom, dress: 'none' } })}
          />
          <Swatches value={character.clothing.bottomColor} onPick={(bottomColor) => patch({ ...character, clothing: { ...character.clothing, bottomColor } })} />
        </>
      );
    case 'dresses':
      return (
        <>
          <p className="hint">A dress replaces the top and trousers until you choose separates.</p>
          <PieceRow
            items={DRESSES}
            selected={character.clothing.dress}
            onPick={(dress) => patch({ ...character, clothing: { ...character.clothing, dress } })}
          />
          <Swatches value={character.clothing.dressColor} onPick={(dressColor) => patch({ ...character, clothing: { ...character.clothing, dressColor } })} />
        </>
      );
    case 'shoes':
      return (
        <>
          <PieceRow
            items={SHOES}
            selected={character.shoes.style}
            onPick={(style) => patch({ ...character, shoes: { ...character.shoes, style } })}
          />
          <Swatches value={character.shoes.color} onPick={(color) => patch({ ...character, shoes: { ...character.shoes, color } })} />
        </>
      );
    case 'hair':
      return (
        <>
          <PieceRow
            items={HAIR_STYLES}
            selected={character.hair.style}
            onPick={(style) => patch({ ...character, hair: { ...character.hair, style } })}
          />
          <Swatches colors={HAIR_COLORS} value={character.hair.color} onPick={(color) => patch({ ...character, hair: { ...character.hair, color } })} />
          <h2>Facial hair</h2>
          <PieceRow
            items={FACIAL_HAIR}
            selected={character.facialHair.style}
            onPick={(style) => patch({ ...character, facialHair: { ...character.facialHair, style } })}
          />
          <Swatches colors={HAIR_COLORS} value={character.facialHair.color} onPick={(color) => patch({ ...character, facialHair: { ...character.facialHair, color } })} />
        </>
      );
    case 'extras':
      return (
        <>
          <h2>Headwear</h2>
          <PieceRow
            items={HEADWEAR}
            selected={character.accessories.headwear}
            onPick={(headwear) => patch({ ...character, accessories: { ...character.accessories, headwear } })}
          />
          <Swatches value={character.accessories.headwearColor} onPick={(headwearColor) => patch({ ...character, accessories: { ...character.accessories, headwearColor } })} />
          <h2>Bag</h2>
          <PieceRow
            items={BAGS}
            selected={character.accessories.bag}
            onPick={(bag) => patch({ ...character, accessories: { ...character.accessories, bag } })}
          />
          <Swatches value={character.accessories.bagColor} onPick={(bagColor) => patch({ ...character, accessories: { ...character.accessories, bagColor } })} />
          <h2>Details</h2>
          <div className="choices">
            <Toggle on={character.accessories.glasses} label="Glasses" onClick={() => patch({ ...character, accessories: { ...character.accessories, glasses: !character.accessories.glasses } })} />
            <Toggle on={character.accessories.earrings} label="Earrings" onClick={() => patch({ ...character, accessories: { ...character.accessories, earrings: !character.accessories.earrings } })} />
            <Toggle on={character.accessories.chain} label="Chain" onClick={() => patch({ ...character, accessories: { ...character.accessories, chain: !character.accessories.chain } })} />
            <Toggle on={character.accessories.watch} label="Watch" onClick={() => patch({ ...character, accessories: { ...character.accessories, watch: !character.accessories.watch } })} />
          </div>
        </>
      );
    default: {
      const _exhaustive: never = rack;
      return _exhaustive;
    }
  }
}

function PieceRow<T extends string>({
  items,
  selected,
  onPick,
}: {
  items: { id: T; label: string }[];
  selected: T;
  onPick: (id: T) => void;
}) {
  return (
    <div className="choices">
      {items.map((item) => (
        <button key={item.id} className={item.id === selected ? 'item on' : 'item'} type="button" onClick={() => onPick(item.id)}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({
  value,
  onPick,
  colors = CLOTH_COLORS,
}: {
  value: string;
  onPick: (hex: string) => void;
  colors?: { id: string; label: string; hex: string }[];
}) {
  return (
    <div className="swatches">
      {colors.map((color) => (
        <button
          key={color.id}
          type="button"
          className={color.hex === value ? 'swatch on' : 'swatch'}
          style={{ background: color.hex }}
          aria-label={color.label}
          aria-pressed={color.hex === value}
          onClick={() => onPick(color.hex)}
        />
      ))}
    </div>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button className={on ? 'choice on' : 'choice'} type="button" aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
}
