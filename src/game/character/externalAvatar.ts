import { MASTER_RIG } from '../assets/rig';
import type { MeshFacts } from '../assets/types';

/**
 * Avaturn is a candidate provider. This module does not load their SDK.
 * Official notes used here, checked against docs.avaturn.me on 2026-10-16:
 * - Web embed can return a GLB URL. The paid API is required for the REST API and for SDK customisation.
 * - Export payload fields match ExportAvatarResult in @avaturn/sdk 1.1.0.
 * - T1 faces are static. T2 can use ARKit blendshapes. Neither is our morph list.
 * - v2024 skeletons are almost the same across bodies. v2023 skeletons differ by body.
 * - Custom clothes must be weighted to the avatar skeleton. Avaturn does not publish a bone list equal to nd-humanoid-v1.
 * - Their Mixamo guide does not say an export already contains idle, walk, run, or turn.
 */
export const AVATURN = {
  provider: 'avaturn',
  connected: false,
  sdkPackage: '@avaturn/sdk',
  assumedBoneNames: [] as const,
  clipsIncludedInExport: false,
} as const;

export type AvaturnGender = 'male' | 'female';

/** Shape of the export callback. Stored beside CharacterConfig, never inside it. */
export interface AvaturnExport {
  avatarId: string;
  sessionId: string;
  url: string;
  urlType: 'dataURL' | 'httpURL';
  avatarSupportsFaceAnimations: boolean;
  bodyId: string;
  gender: AvaturnGender;
}

export interface ExternalCharacterLink {
  provider: 'avaturn';
  avatarId: string;
  sessionId: string;
  bodyId: string;
  providerGender: AvaturnGender;
  faceAnimations: boolean;
  sourceUrl: string;
  urlType: 'dataURL' | 'httpURL';
}

export interface RigAssessment {
  skinned: boolean;
  missingBones: string[];
  missingClips: string[];
  matchesContract: boolean;
}

export function linkFromAvaturnExport(data: AvaturnExport): ExternalCharacterLink {
  return {
    provider: 'avaturn',
    avatarId: data.avatarId,
    sessionId: data.sessionId,
    bodyId: data.bodyId,
    providerGender: data.gender,
    faceAnimations: data.avatarSupportsFaceAnimations,
    sourceUrl: data.url,
    urlType: data.urlType,
  };
}

/** Compare a parsed GLB with nd-humanoid-v1. This does not change the live avatar. */
export function assessHumanoid(facts: Pick<MeshFacts, 'skinned' | 'boneNames' | 'clipNames'>): RigAssessment {
  const missingBones = MASTER_RIG.bones.filter((bone) => !facts.boneNames.includes(bone));
  const missingClips = MASTER_RIG.requiredClips.filter((clip) => !facts.clipNames.includes(clip));
  return {
    skinned: facts.skinned,
    missingBones: [...missingBones],
    missingClips: [...missingClips],
    matchesContract: facts.skinned && missingBones.length === 0 && missingClips.length === 0,
  };
}
