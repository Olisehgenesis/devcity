export interface AvatarFeatures {
  faceShape: string;
  eyes: string;
  eyebrows: string;
  nose: string;
  mouth: string;
  hair: string;
  hairColor: string;
  skinColor: string;
  eyeColor: string;
  accessories: string[];
  facialHair: string;
}

export const AVATAR_OPTIONS = {
  faceShape: ['round', 'oval', 'square', 'heart', 'diamond'],
  eyes: ['round', 'almond', 'wide', 'narrow', 'upturned', 'downturned'],
  eyebrows: ['straight', 'arched', 'thick', 'thin', 'bushy'],
  nose: ['small', 'medium', 'large', 'wide', 'pointed', 'button'],
  mouth: ['smile', 'neutral', 'frown', 'open', 'smirk', 'laugh'],
  hair: [
    'short',
    'medium',
    'long',
    'bob',
    'pixie',
    'curly',
    'wavy',
    'straight',
    'afro',
    'bald',
    'buzz',
    'fade',
    'undercut',
    'ponytail',
    'bun',
    'braids',
    'dreadlocks',
  ],
  hairColor: [
    '#000000',
    '#1a1a2e',
    '#2d1b1b',
    '#4a2c2a',
    '#6b4423',
    '#8b5a2b',
    '#a0522d',
    '#c49a6c',
    '#d4a843',
    '#e8c56d',
    '#f5deb3',
    '#fff8dc',
    '#ff6b6b',
    '#ff8e8e',
    '#ffb3b3',
    '#6bcb77',
    '#4ecdc4',
    '#45b7d1',
    '#96c93d',
    '#ffe66d',
  ],
  skinColor: [
    '#fdf2e9',
    '#fadfc9',
    '#f5c6a5',
    '#e8b49c',
    '#d4a373',
    '#c9966c',
    '#b8865e',
    '#a67c52',
    '#8d6e4a',
    '#7d5c3d',
    '#6b4e31',
    '#5d4037',
    '#4e342e',
    '#3e2723',
    '#2d1b1b',
    '#1a1a1a',
  ],
  eyeColor: [
    '#000000',
    '#1a1a2e',
    '#2c3e50',
    '#34495e',
    '#5d6d7e',
    '#85929e',
    '#27ae60',
    '#2ecc71',
    '#3498db',
    '#2980b9',
    '#8e44ad',
    '#9b59b6',
    '#e67e22',
    '#f39c12',
    '#e74c3c',
    '#c0392b',
  ],
  accessories: [
    'none',
    'glasses-round',
    'glasses-square',
    'glasses-cat-eye',
    'glasses-aviator',
    'earrings-stud',
    'earrings-hoop',
    'earrings-dangle',
    'necklace-simple',
    'necklace-chain',
    'hat-baseball',
    'hat-beanie',
    'hat-fedora',
    'headband',
    'mask',
  ],
  facialHair: ['none', 'stubble', 'mustache', 'goatee', 'beard-short', 'beard-medium', 'beard-long'],
} as const;

export function generateRandomFeatures(seed?: string): AvatarFeatures {
  const random = seed ? createSeededRandom(seed) : Math.random;

  const pick = <T>(arr: readonly T[]): T => arr[Math.floor(random() * arr.length)];
  const pickMultiple = <T>(arr: readonly T[], count: number): T[] => {
    const shuffled = [...arr].sort(() => random() - 0.5);
    return shuffled.slice(0, count);
  };

  return {
    faceShape: pick(AVATAR_OPTIONS.faceShape),
    eyes: pick(AVATAR_OPTIONS.eyes),
    eyebrows: pick(AVATAR_OPTIONS.eyebrows),
    nose: pick(AVATAR_OPTIONS.nose),
    mouth: pick(AVATAR_OPTIONS.mouth),
    hair: pick(AVATAR_OPTIONS.hair),
    hairColor: pick(AVATAR_OPTIONS.hairColor),
    skinColor: pick(AVATAR_OPTIONS.skinColor),
    eyeColor: pick(AVATAR_OPTIONS.eyeColor),
    accessories: pickMultiple(AVATAR_OPTIONS.accessories, Math.floor(random() * 2)),
    facialHair: pick(AVATAR_OPTIONS.facialHair),
  };
}

function createSeededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  let state = Math.abs(hash);

  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export function featuresToDiceBearParams(features: AvatarFeatures): Record<string, string> {
  const styleMap: Record<string, string> = {
    faceShape: {
      round: 'circle',
      oval: 'oval',
      square: 'square',
      heart: 'heart',
      diamond: 'diamond',
    }[features.faceShape] || 'circle',
    eyes: {
      round: 'round',
      almond: 'almond',
      wide: 'wide',
      narrow: 'narrow',
      upturned: 'happy',
      downturned: 'sad',
    }[features.eyes] || 'round',
    eyebrows: {
      straight: 'straight',
      arched: 'arched',
      thick: 'thick',
      thin: 'thin',
      bushy: 'bushy',
    }[features.eyebrows] || 'straight',
    nose: {
      small: 'small',
      medium: 'medium',
      large: 'large',
      wide: 'wide',
      pointed: 'pointed',
      button: 'button',
    }[features.nose] || 'medium',
    mouth: {
      smile: 'smile',
      neutral: 'neutral',
      frown: 'frown',
      open: 'open',
      smirk: 'smirk',
      laugh: 'laugh',
    }[features.mouth] || 'smile',
    hair: features.hair,
    hairColor: features.hairColor.replace('#', ''),
    skinColor: features.skinColor.replace('#', ''),
    eyeColor: features.eyeColor.replace('#', ''),
    accessories: features.accessories.filter((a) => a !== 'none').join(',') || 'none',
    facialHair: features.facialHair,
  };

  return styleMap;
}

export function generateDiceBearUrl(features: AvatarFeatures, size = 200): string {
  const params = featuresToDiceBearParams(features);
  const query = new URLSearchParams(params);
  query.set('size', size.toString());
  query.set('backgroundType', 'solid');
  query.set('backgroundColor', 'ffffff');
  return `https://api.dicebear.com/9.x/avataaars/svg?${query.toString()}`;
}

export function generateDiceBearPngUrl(features: AvatarFeatures, size = 200): string {
  const params = featuresToDiceBearParams(features);
  const query = new URLSearchParams(params);
  query.set('size', size.toString());
  query.set('backgroundType', 'solid');
  query.set('backgroundColor', 'ffffff');
  return `https://api.dicebear.com/9.x/avataaars/png?${query.toString()}`;
}

export function generateInitialsAvatar(name: string, size = 200): string {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const colors = [
    '#3b82f6',
    '#22c55e',
    '#f97316',
    '#8b5cf6',
    '#ec4899',
    '#eab308',
    '#06b6d4',
    '#f43f5e',
  ];
  const color = colors[name.length % colors.length];
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(initials)}&size=${size}&backgroundColor=${color.replace('#', '')}&fontSize=50&charLimit=2`;
}

export function generateIdenticonAvatar(seed: string, size = 200): string {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function generateBotttsAvatar(seed: string, size = 200): string {
  return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function generatePersonaAvatar(seed: string, size = 200): string {
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function getAvatarUrl(
  type: 'dicebear' | 'initials' | 'identicon' | 'bottts' | 'personas',
  seed: string,
  size = 200,
  features?: AvatarFeatures
): string {
  switch (type) {
    case 'dicebear':
      return features ? generateDiceBearUrl(features, size) : generateDiceBearUrl(generateRandomFeatures(seed), size);
    case 'initials':
      return generateInitialsAvatar(seed, size);
    case 'identicon':
      return generateIdenticonAvatar(seed, size);
    case 'bottts':
      return generateBotttsAvatar(seed, size);
    case 'personas':
      return generatePersonaAvatar(seed, size);
    default:
      return generateIdenticonAvatar(seed, size);
  }
}

export const DEFAULT_AVATAR_FEATURES: AvatarFeatures = {
  faceShape: 'oval',
  eyes: 'round',
  eyebrows: 'straight',
  nose: 'medium',
  mouth: 'smile',
  hair: 'short',
  hairColor: '#2d1b1b',
  skinColor: '#f5c6a5',
  eyeColor: '#2c3e50',
  accessories: [],
  facialHair: 'none',
};