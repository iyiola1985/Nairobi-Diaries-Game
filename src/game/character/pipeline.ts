/**
 * The character on screen is the supplied Mixamo FBX in public/assets/characters/player.
 * Strut Walking and Jogging share that skeleton and drive walk and run.
 * CharacterConfig remains the save contract. Wardrobe colours do not restyle this mesh.
 */
export const CHARACTER_PIPELINE = {
  source: 'supplied-fbx',
  format: 'fbx',
  futureFormat: 'glb',
  registryId: 'nd-humanoid-v1',
} as const;

/** Not in the repository. The studio must not pretend these are loaded. */
export const MISSING_CHARACTER_ASSETS = [
  'Rigged body GLB with one shared skeleton',
  'Face and body morph targets',
  'Hair meshes for afro, braids, cornrows, locs, twists, and cuts',
  'Clothing, footwear, and accessory meshes fitted to that skeleton',
] as const;
