import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { CLAIM_RADIUS_M, distanceMeters } from './geo';
import {
  DEV_TEST_FAR,
  DEV_TEST_NEAR,
  DEV_TEST_PLACES,
  clientMayUseDevLocation,
  devLocationMockEnabled,
} from './dev-location';

const local = { NODE_ENV: 'development', BETTER_AUTH_URL: 'http://localhost:3000' };

test('production cannot enable the location mock', () => {
  assert.equal(devLocationMockEnabled({ ...local, NODE_ENV: 'production' }), false);
  assert.equal(devLocationMockEnabled({ ...local, VERCEL_ENV: 'production' }), false);
  assert.equal(devLocationMockEnabled({ NODE_ENV: 'development', BETTER_AUTH_URL: 'https://devcity.fun' }), false);
  assert.equal(devLocationMockEnabled({ NODE_ENV: 'development' }), false);
  assert.equal(clientMayUseDevLocation('production'), false);
  assert.equal(clientMayUseDevLocation('development'), true);
});

test('a local development process may enable the location mock', () => {
  assert.equal(devLocationMockEnabled(local), true);
});

test('mock places are labeled TEST and are not real claims', () => {
  assert.ok(DEV_TEST_PLACES.length >= 3);
  for (const place of DEV_TEST_PLACES) {
    assert.match(place.id, /^test-/);
    assert.match(place.name, /^TEST /);
    assert.match(place.detail, /Not a real/);
  }
});

test('near and far fixes cover claim range and the too-far state', () => {
  const drop = DEV_TEST_PLACES.find((place) => place.kind === 'drop');
  assert.ok(drop);
  const near = distanceMeters(DEV_TEST_NEAR.latitude, DEV_TEST_NEAR.longitude, drop.latitude, drop.longitude);
  const far = distanceMeters(DEV_TEST_FAR.latitude, DEV_TEST_FAR.longitude, drop.latitude, drop.longitude);
  assert.ok(near <= CLAIM_RADIUS_M);
  assert.ok(far > CLAIM_RADIUS_M);
});

test('the location mock gate is compiled out of production bundles', () => {
  const source = readFileSync(new URL('../../app/components/DevLocationGate.tsx', import.meta.url), 'utf8');
  assert.match(source, /process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /import\('\.\/DevLocationPanel'\)/);
});
