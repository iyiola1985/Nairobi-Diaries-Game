import { describe, expect, it } from 'vitest';
import { MASTER_RIG } from '../assets/rig';
import { assetById } from '../assets/registry';
import { createDefaultCharacter } from './presets';
import { AVATURN, assessHumanoid, linkFromAvaturnExport } from './externalAvatar';

describe('external avatar adapter', () => {
  it('does not treat Avaturn as connected or as our skeleton', () => {
    expect(AVATURN.connected).toBe(false);
    expect(AVATURN.assumedBoneNames).toEqual([]);
    expect(AVATURN.clipsIncludedInExport).toBe(false);
    expect(assetById('nd-humanoid-v1')?.status).toBe('absent');
  });

  it('accepts only the nd-humanoid-v1 bone and clip names', () => {
    const match = assessHumanoid({
      skinned: true,
      boneNames: [...MASTER_RIG.bones],
      clipNames: [...MASTER_RIG.requiredClips],
    });
    expect(match.matchesContract).toBe(true);

    const otherRig = assessHumanoid({
      skinned: true,
      boneNames: ['Hips', 'Spine', 'LeftArm', 'RightArm', 'Head'],
      clipNames: ['idle'],
    });
    expect(otherRig.matchesContract).toBe(false);
    expect(otherRig.missingBones).toContain('LeftUpperArm');
    expect(otherRig.missingBones).toContain('Chest');
    expect(otherRig.missingClips).toEqual(['walk', 'run', 'turn']);
  });

  it('keeps an Avaturn export beside the saved character', () => {
    const character = createDefaultCharacter();
    const link = linkFromAvaturnExport({
      avatarId: 'avatar-1',
      sessionId: 'session-1',
      url: 'https://example.invalid/avatar.glb',
      urlType: 'httpURL',
      avatarSupportsFaceAnimations: false,
      bodyId: 'body_1',
      gender: 'female',
    });
    expect(link.provider).toBe('avaturn');
    expect(link.faceAnimations).toBe(false);
    expect(link.providerGender).toBe('female');
    expect(character.presentation).toBe(createDefaultCharacter().presentation);
    expect(JSON.stringify(character)).not.toContain('avatar-1');
  });
});
