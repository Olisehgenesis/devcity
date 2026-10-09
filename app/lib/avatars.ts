export function dicebearAvatarUrl(seed: string, backgroundColor = 'fffc00') {
  const params = new URLSearchParams({ seed, backgroundColor });
  return `https://api.dicebear.com/9.x/notionists/svg?${params.toString()}`;
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