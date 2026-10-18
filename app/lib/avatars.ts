import { originalAvatarDataUri } from '@/lib/original-avatar';

/** Original avatar drawing. The name stays so existing callers keep working. */
export function dicebearAvatarUrl(seed: string, backgroundColor?: string) {
  void backgroundColor;
  return originalAvatarDataUri(seed);
}

export function avatarBackgroundForColor(color: string) {
  const backgrounds: Record<string, string> = {
    coral: 'ff795f',
    yellow: 'ffd75e',
    blue: '83d8ee',
    pink: 'f5a6c6',
    mint: '8bffcc',
    lime: 'd6ff55',
  };
  return backgrounds[color] ?? 'd6ff55';
}