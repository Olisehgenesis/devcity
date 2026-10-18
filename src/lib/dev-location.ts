import { devTestAccountsEnabled } from './dev-test-auth';

export type DevLocationMode = 'off' | 'near' | 'far' | 'denied';

export type DevTestPlace = {
  id: string;
  kind: 'drop' | 'place' | 'event';
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
};

/**
 * Simulated GPS used only by the local test tools.
 * These coordinates are a test fix, not a venue, and every place is labeled TEST.
 */
export const DEV_TEST_NEAR = { latitude: 19.0662, longitude: 72.8697 };
export const DEV_TEST_FAR = { latitude: 19.0682, longitude: 72.8697 };

export const DEV_TEST_PLACES: DevTestPlace[] = [
  {
    id: 'test-drop-near',
    kind: 'drop',
    name: 'TEST drop',
    detail: 'TEST data. Not a real drop.',
    latitude: DEV_TEST_NEAR.latitude,
    longitude: DEV_TEST_NEAR.longitude,
  },
  {
    id: 'test-place-near',
    kind: 'place',
    name: 'TEST place',
    detail: 'TEST data. Not a real place.',
    latitude: DEV_TEST_NEAR.latitude + 0.00045,
    longitude: DEV_TEST_NEAR.longitude + 0.00045,
  },
  {
    id: 'test-event-near',
    kind: 'event',
    name: 'TEST event',
    detail: 'TEST data. Not a real event.',
    latitude: DEV_TEST_NEAR.latitude - 0.0004,
    longitude: DEV_TEST_NEAR.longitude + 0.00055,
  },
];

/** Fail closed. A production build and a production host cannot enable the mock. */
export function devLocationMockEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return devTestAccountsEnabled(env);
}

/** Direct NODE_ENV check so a production bundle can drop the mock. */
export function clientMayUseDevLocation(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return nodeEnv !== 'production';
}
