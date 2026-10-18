import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BRAND, cityPinSvg } from './city-markers';

describe('city pin family', () => {
  it('keeps every marker inside its viewBox and anchors the tip at the bottom', () => {
    for (const kind of ['person', 'place', 'event', 'drop'] as const) {
      const pin = cityPinSvg({ kind, title: 'A very long marker name', live: kind === 'event' });
      assert.equal(pin.anchor, 'bottom');
      assert.match(pin.svg, new RegExp(`viewBox="0 0 ${pin.width} ${pin.height}"`));
      assert.equal(pin.svg.includes('y="-'), false);
      assert.equal(pin.svg.includes('x="-'), false);
      assert.match(pin.svg, /M[\d.]+ 89 C/);
    }
    const family = ['person', 'place', 'event', 'drop'].map((kind) => cityPinSvg({
      kind: kind as 'person' | 'place' | 'event' | 'drop',
      title: kind,
    }).svg).join('');
    assert.match(family, new RegExp(BRAND.primary, 'i'));
    assert.match(family, new RegExp(BRAND.secondary, 'i'));
    assert.match(family, new RegExp(BRAND.accent, 'i'));
  });
});
