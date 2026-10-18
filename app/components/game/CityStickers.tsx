const STICKERS = ['wave', 'drop', 'pin', 'spark', 'star', 'heart', 'check', 'face'] as const;

export type CityStickerName = (typeof STICKERS)[number];

export function CitySticker({ name, size = 36 }: { name: CityStickerName; size?: number }) {
  return <img src={`/assets/original/sticker-${name}.svg`} alt="" width={size} height={size} />;
}

export function StickerStrip() {
  return (
    <div className="sticker-strip" aria-hidden="true">
      {STICKERS.map((name) => <CitySticker key={name} name={name} />)}
    </div>
  );
}
