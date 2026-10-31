import type { CharacterConfig } from '../character/types';
import { deriveLook } from '../character/look';

export interface WearPiece {
  slot: string;
  visible: boolean;
  color: string | null;
}

/**
 * Which future meshes to show for a saved character.
 * Clothing changes this list. It does not change face, skin, or body fields.
 */
export function wearPlan(config: CharacterConfig): WearPiece[] {
  const look = deriveLook(config);
  const { clothing, shoes, accessories, hair, facialHair } = config;
  const fullDress = clothing.dress === 'evening' || clothing.dress === 'print-dress';
  return [
    { slot: 'body', visible: true, color: look.skin },
    { slot: 'hair', visible: true, color: hair.color },
    { slot: 'facialHair', visible: facialHair.style !== 'none', color: facialHair.color },
    { slot: 'top', visible: clothing.dress === 'none', color: clothing.topColor },
    { slot: 'outer', visible: clothing.outer !== 'none' && !fullDress, color: clothing.outerColor },
    { slot: 'bottom', visible: clothing.dress === 'none', color: clothing.bottomColor },
    { slot: 'dress', visible: clothing.dress !== 'none', color: clothing.dressColor },
    { slot: 'shoes', visible: true, color: shoes.color },
    { slot: 'headwear', visible: accessories.headwear !== 'none', color: accessories.headwearColor },
    { slot: 'bag', visible: accessories.bag !== 'none', color: accessories.bagColor },
    { slot: 'glasses', visible: accessories.glasses, color: null },
    { slot: 'earrings', visible: accessories.earrings, color: null },
    { slot: 'chain', visible: accessories.chain, color: null },
    { slot: 'watch', visible: accessories.watch, color: null },
  ];
}
