import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BRAND, cityPinSvg, markerScaleForZoom } from './city-markers';

describe('city pin family', () => {
  it('keeps the people pin and gives every other kind its own 3D marker', () => {
    const person = cityPinSvg({ kind: 'person', title: 'A very long marker name' });
    assert.equal(person.anchor, 'bottom');
    assert.match(person.svg, new RegExp(`viewBox="0 0 ${person.width} ${person.height}"`));
    assert.match(person.svg, /M[\d.]+ 89 C/);
    assert.equal(person.svg.includes('y="-'), false);
    assert.equal(person.svg.includes('x="-'), false);

    for (const kind of ['place', 'event', 'drop'] as const) {
      const pin = cityPinSvg({ kind, title: 'A very long marker name', live: kind === 'event' });
      assert.equal(pin.anchor, 'bottom');
      assert.match(pin.svg, new RegExp(`viewBox="0 0 ${pin.width} ${pin.height}"`));
      assert.equal(pin.svg.includes('y="-'), false);
      assert.equal(pin.svg.includes('x="-'), false);
      assert.match(pin.svg, /l-4 18z/);
      assert.equal(pin.svg.includes('cy="54"'), false);
      assert.equal(pin.svg.includes('M6 10h28'), false);
    }
    const event = cityPinSvg({ kind: 'event', title: 'Stage' }).svg;
    const drop = cityPinSvg({ kind: 'drop', title: 'Crate' }).svg;
    const place = cityPinSvg({ kind: 'place', title: 'Shop' }).svg;
    assert.notEqual(event, drop);
    assert.notEqual(drop, place);
    assert.match(event, /M12 36 L32 16/);
    assert.match(drop, /M14 32 L32 22/);
    assert.match(place, /M8 38 L30 24/);
    assert.ok(markerScaleForZoom(10) < markerScaleForZoom(14));
    assert.ok(markerScaleForZoom(14) < markerScaleForZoom(17));
    assert.ok(markerScaleForZoom(10) >= 0.5);
    assert.ok(markerScaleForZoom(18) <= 1.22);

    const family = ['person', 'place', 'event', 'drop'].map((kind) => cityPinSvg({
      kind: kind as 'person' | 'place' | 'event' | 'drop',
      title: kind,
    }).svg).join('');
    assert.match(family, new RegExp(BRAND.primary, 'i'));
    assert.match(family, new RegExp(BRAND.secondary, 'i'));
    assert.match(family, new RegExp(BRAND.accent, 'i'));
  });
});
