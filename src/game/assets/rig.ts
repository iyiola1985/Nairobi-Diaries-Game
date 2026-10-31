/**
 * Contract for a future body GLB. No file in the repo satisfies it yet.
 * Mixamo or other sources may be retargeted onto these names. They are not
 * accepted until the bone list, clips, and scale match.
 */
export const MASTER_RIG = {
  id: 'nd-humanoid-v1',
  unit: 'metre',
  up: 'y',
  forward: 'negative-z',
  restHeightM: 1.7,
  bones: [
    'Hips',
    'Spine',
    'Chest',
    'Neck',
    'Head',
    'LeftShoulder',
    'LeftUpperArm',
    'LeftLowerArm',
    'LeftHand',
    'RightShoulder',
    'RightUpperArm',
    'RightLowerArm',
    'RightHand',
    'LeftUpperLeg',
    'LeftLowerLeg',
    'LeftFoot',
    'RightUpperLeg',
    'RightLowerLeg',
    'RightFoot',
  ],
  requiredClips: ['idle', 'walk', 'run', 'turn'],
  emoteClips: ['wave', 'talk', 'sit'],
  morphs: ['jaw', 'cheeks', 'chin', 'eyeSize', 'eyeSpacing', 'brow', 'noseWidth', 'noseLength', 'lipFullness'],
} as const;

export interface Attachment {
  slot: string;
  bones: readonly string[];
  hides: readonly string[];
}

/** Where a validated clothing or hair GLB attaches. Visibility still follows deriveLook. */
export const ATTACHMENTS: readonly Attachment[] = [
  { slot: 'hair', bones: ['Head'], hides: [] },
  { slot: 'facialHair', bones: ['Head'], hides: [] },
  { slot: 'top', bones: ['Chest', 'Spine'], hides: [] },
  { slot: 'outer', bones: ['Chest'], hides: [] },
  { slot: 'bottom', bones: ['Hips'], hides: [] },
  { slot: 'dress', bones: ['Hips', 'Chest'], hides: ['top', 'bottom'] },
  { slot: 'shoes', bones: ['LeftFoot', 'RightFoot'], hides: [] },
  { slot: 'headwear', bones: ['Head'], hides: [] },
  { slot: 'bag', bones: ['Chest'], hides: [] },
  { slot: 'glasses', bones: ['Head'], hides: [] },
  { slot: 'earrings', bones: ['Head'], hides: [] },
  { slot: 'chain', bones: ['Chest'], hides: [] },
  { slot: 'watch', bones: ['LeftHand'], hides: [] },
];

export const TRIANGLE_BUDGET: Record<string, number> = {
  'character-body': 25000,
  'character-hair': 8000,
  'character-clothing': 8000,
  'character-shoes': 4000,
  'character-accessory': 3000,
  landmark: 80000,
  building: 4000,
  prop: 3000,
  vehicle: 20000,
  furniture: 6000,
  'pipeline-probe': 64,
};
