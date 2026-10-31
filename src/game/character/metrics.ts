import type { BodyMetrics, CharacterConfig } from './types';

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

export function bodyMetrics(config: CharacterConfig): BodyMetrics {
  const presentation = config.presentation;
  const base =
    presentation === 'feminine'
      ? { shoulder: 0.92, hip: 1.08, waist: 0.86, chest: 1.02 }
      : presentation === 'masculine'
        ? { shoulder: 1.12, hip: 0.94, waist: 1, chest: 1.08 }
        : presentation === 'androgynous'
          ? { shoulder: 1, hip: 1, waist: 0.94, chest: 1 }
          : assertNever(presentation);
  const build = 0.9 + config.body.build * 0.22;
  return {
    height: 1.52 + config.body.height * 0.4,
    shoulder: base.shoulder * (0.86 + config.body.shoulder * 0.32) * build,
    hip: base.hip * (0.86 + config.body.hip * 0.32),
    waist: base.waist * (0.9 + config.body.build * 0.18),
    chest: base.chest * (0.92 + config.body.build * 0.2),
  };
}

export function mixHex(from: string, to: string, amount: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = parse(from);
  const b = parse(to);
  const t = Math.max(0, Math.min(1, amount));
  const channels = a.map((channel, index) => Math.round(channel + (b[index] - channel) * t));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function faceTone(skin: string, foundation: number): string {
  const toward = foundation >= 0.5 ? '#f0d2b0' : '#2a1812';
  return mixHex(skin, toward, Math.abs(foundation - 0.5) * 0.45);
}

export function naturalLip(skin: string): string {
  return mixHex(skin, '#6a2430', 0.42);
}

export function faceSignature(config: CharacterConfig): string {
  return JSON.stringify({
    presentation: config.presentation,
    skin: config.skin,
    body: config.body,
    face: config.face,
    hair: config.hair,
    facialHair: config.facialHair,
    makeup: config.makeup,
  });
}

export function validateIdentity(displayName: string, username: string): { displayName?: string; username?: string } {
  const errors: { displayName?: string; username?: string } = {};
  const name = displayName.trim();
  if (name.length < 2 || name.length > 24) errors.displayName = 'Use 2–24 characters.';
  if (!/^[a-z0-9_]{3,16}$/.test(username)) errors.username = '3–16 lowercase letters, numbers, or underscores.';
  return errors;
}

export function identityReady(displayName: string, username: string): boolean {
  return Object.keys(validateIdentity(displayName, username)).length === 0;
}
