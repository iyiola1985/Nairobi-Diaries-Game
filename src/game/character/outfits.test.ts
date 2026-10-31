import { describe, expect, it } from 'vitest';
import { createDefaultCharacter } from './presets';
import { OUTFITS, takeOff, takeOffExtras, wearOutfit } from './outfits';

describe('wearOutfit', () => {
  it('changes clothes and keeps the name, face, and skin', () => {
    const character = createDefaultCharacter();
    const named = { ...character, displayName: 'Amina', username: 'amina', skin: '#4a2e1e' };
    const evening = OUTFITS.find((item) => item.id === 'evening');
    if (!evening) throw new Error('missing evening outfit');
    const dressed = wearOutfit(named, evening);
    expect(dressed.displayName).toBe('Amina');
    expect(dressed.username).toBe('amina');
    expect(dressed.skin).toBe('#4a2e1e');
    expect(dressed.face).toEqual(named.face);
    expect(dressed.hair).toEqual(named.hair);
    expect(dressed.clothing.dress).toBe('evening');
    expect(dressed.shoes.style).toBe('heels');
    expect(dressed.accessories.earrings).toBe(true);
  });

  it('takes a jacket or a whole set of extras off without touching the top', () => {
    const character = createDefaultCharacter();
    const denim = OUTFITS.find((item) => item.id === 'denim');
    if (!denim) throw new Error('missing denim outfit');
    const dressed = wearOutfit(character, denim);
    const jacketOff = takeOff(dressed, 'jacket');
    expect(jacketOff.clothing.outer).toBe('none');
    expect(jacketOff.clothing.top).toBe('tee');
    const cleared = takeOffExtras(dressed);
    expect(cleared.clothing.outer).toBe('none');
    expect(cleared.clothing.dress).toBe('none');
    expect(cleared.clothing.top).toBe('tee');
    expect(cleared.accessories.glasses).toBe(false);
  });
});
