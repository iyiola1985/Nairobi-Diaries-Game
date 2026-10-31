import type { AssetRecord, MeshFacts, ValidationCheck } from './types';
import { MASTER_RIG, TRIANGLE_BUDGET } from './rig';

function check(id: string, pass: boolean, detail: string): ValidationCheck {
  return { id, pass, detail };
}

function budgetFor(role: AssetRecord['role']): number | null {
  return TRIANGLE_BUDGET[role] ?? null;
}

export function validateFacts(record: AssetRecord, facts: MeshFacts): ValidationCheck[] {
  const checks: ValidationCheck[] = [
    check('file', record.file !== null, record.file ?? 'No file path is registered.'),
    check('license', record.license.trim().length > 8, record.license || 'License is missing.'),
    check('meshes', facts.meshCount > 0, facts.meshCount === 0 ? 'The file has no mesh.' : `${facts.meshCount} mesh.`),
    check(
      'triangles',
      facts.triangleCount > 0,
      facts.triangleCount > 0 ? `${facts.triangleCount} triangles.` : 'The mesh has no triangles.',
    ),
    check('bytes', facts.byteLength > 20 && facts.byteLength < 8_000_000, `${facts.byteLength} bytes.`),
  ];

  const budget = budgetFor(record.role);
  if (budget !== null) {
    checks.push(
      check(
        'budget',
        facts.triangleCount <= budget,
        facts.triangleCount <= budget ? `Within the ${budget} triangle budget.` : `${facts.triangleCount} triangles exceeds ${budget}.`,
      ),
    );
  }

  switch (record.role) {
    case 'pipeline-probe': {
      const [x, y, z] = facts.size;
      const metre = [x, y, z].every((axis) => axis > 0.9 && axis < 1.1);
      checks.push(check('scale', metre, `Bounds ${x.toFixed(2)} × ${y.toFixed(2)} × ${z.toFixed(2)} m.`));
      checks.push(check('not-a-character', !facts.skinned, facts.skinned ? 'The probe must not include a skeleton.' : 'Unskinned, as declared.'));
      break;
    }
    case 'character-body': {
      const missing = MASTER_RIG.bones.filter((bone) => !facts.boneNames.includes(bone));
      const missingClips = MASTER_RIG.requiredClips.filter((clip) => !facts.clipNames.includes(clip));
      const height = facts.size[1];
      checks.push(check('skinned', facts.skinned, facts.skinned ? 'Skinned mesh found.' : 'A body needs a skeleton.'));
      checks.push(check('bones', missing.length === 0, missing.length === 0 ? 'Master bones present.' : `Missing bones: ${missing.join(', ')}.`));
      checks.push(check('clips', missingClips.length === 0, missingClips.length === 0 ? 'Locomotion clips present.' : `Missing clips: ${missingClips.join(', ')}.`));
      checks.push(check('height', height >= 1.45 && height <= 2.05, `Height ${height.toFixed(2)} m.`));
      break;
    }
    case 'character-hair':
    case 'character-clothing':
    case 'character-shoes':
    case 'character-accessory':
      checks.push(check('rig', record.rigId === MASTER_RIG.id, record.rigId === MASTER_RIG.id ? `Fits ${MASTER_RIG.id}.` : 'Set rigId to the master humanoid.'));
      checks.push(check('slot', record.slots.length > 0, record.slots.length > 0 ? record.slots.join(', ') : 'Name the CharacterConfig slot this mesh fills.'));
      break;
    case 'animation': {
      const missingClips = MASTER_RIG.requiredClips.filter((clip) => !facts.clipNames.includes(clip));
      checks.push(check('clips', missingClips.length === 0, missingClips.length === 0 ? 'Required clips present.' : `Missing clips: ${missingClips.join(', ')}.`));
      checks.push(check('rig', record.rigId === MASTER_RIG.id, `Clips must target ${MASTER_RIG.id}.`));
      break;
    }
    case 'landmark':
    case 'building':
    case 'prop':
    case 'vehicle':
    case 'furniture':
    case 'environment': {
      const [x, y, z] = facts.size;
      const finite = [x, y, z].every((axis) => Number.isFinite(axis) && axis > 0 && axis < 400);
      checks.push(check('scale', finite, `Bounds ${x.toFixed(1)} × ${y.toFixed(1)} × ${z.toFixed(1)} m.`));
      if (record.role === 'landmark') {
        checks.push(check('placement', record.placement !== null, record.placement ? 'OSM placement is recorded.' : 'A landmark needs coordinates before it can be placed.'));
      }
      break;
    }
    case 'texture':
      checks.push(check('materials', facts.materialNames.length > 0, facts.materialNames.join(', ') || 'No material names.'));
      break;
    default: {
      const _exhaustive: never = record.role;
      return _exhaustive;
    }
  }

  return checks;
}

export function checksPass(checks: ValidationCheck[]): boolean {
  return checks.every((item) => item.pass);
}
