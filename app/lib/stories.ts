export interface StorySegment {
  text: string;
  sub?: string;
}

export interface Story {
  name: string;
  initials: string;
  color: string;
  time: string;
  place: string;
  segments: StorySegment[];
}

export const stories: Record<string, Story> = {
  Genesis: {
    name: 'Genesis',
    initials: 'G',
    color: 'coral',
    time: '2h',
    place: 'KICC rooftop · 120 m',
    segments: [
      { text: 'up on the roof', sub: 'the whole city from up here' },
      { text: 'sound check in 10', sub: 'bring it up on the left channel' },
      { text: 'who is coming?', sub: 'drop a pin if you are close' },
    ],
  },
  Amina: {
    name: 'Amina',
    initials: 'A',
    color: 'yellow',
    time: '4h',
    place: 'The Foundry · 95 m',
    segments: [
      { text: 'just claimed 20 DEV', sub: 'third drop this week' },
      { text: 'foundry is warming up', sub: 'corner table is open' },
    ],
  },
  Kai: {
    name: 'Kai',
    initials: 'K',
    color: 'blue',
    time: '1h',
    place: 'Courtyard stage · 400 m',
    segments: [
      { text: 'stage is live', sub: 'set starts when the lights drop' },
      { text: 'new set dropping tonight', sub: 'onchain in an hour' },
      { text: 'front row is yours', sub: 'look for the lime wristband' },
    ],
  },
  Mara: {
    name: 'Mara',
    initials: 'M',
    color: 'pink',
    time: '6h',
    place: 'The Foundry · 240 m',
    segments: [
      { text: 'the foundry is full', sub: 'every seat taken' },
      { text: 'say hi if you are near', sub: 'i am by the window' },
    ],
  },
  Tobi: {
    name: 'Tobi',
    initials: 'T',
    color: 'mint',
    time: '30m',
    place: 'Dev meetup · 180 m',
    segments: [
      { text: 'demoing at booth 4', sub: 'come test the claim loop' },
      { text: 'come through', sub: 'passes at the door' },
    ],
  },
};
