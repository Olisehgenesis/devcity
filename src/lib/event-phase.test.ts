import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { eventPhase, rsvpAllowed } from './event-phase';

const future = { startDate: '2026-12-20', endDate: '2026-12-22', startTime: '09:00', endTime: '18:00' };
const now = Date.parse('2026-12-21T12:00:00Z');

describe('event phase', () => {
  it('uses real dates, including full ISO timestamps', () => {
    assert.equal(eventPhase(future, Date.parse('2026-12-01T00:00:00Z')), 'upcoming');
    assert.equal(eventPhase(future, now), 'live');
    assert.equal(eventPhase(future, Date.parse('2026-12-23T00:00:00Z')), 'past');
    assert.equal(eventPhase({
      startDate: '2026-12-20T00:00:00.000Z',
      endDate: '2026-12-22T00:00:00.000Z',
      startTime: '09:00:00',
      endTime: '18:00:00',
    }, now), 'live');
  });

  it('does not treat a missing date as live', () => {
    assert.equal(eventPhase({ startDate: null, endDate: null }, now), 'undated');
    assert.equal(eventPhase({ startDate: 'not-a-date' }, now), 'undated');
  });

  it('refuses RSVP on an expired or undated event', () => {
    assert.equal(rsvpAllowed('past', 'going'), false);
    assert.equal(rsvpAllowed('past', 'interested'), false);
    assert.equal(rsvpAllowed('undated', 'going'), false);
    assert.equal(rsvpAllowed('upcoming', 'going'), true);
    assert.equal(rsvpAllowed('live', 'going'), true);
    assert.equal(rsvpAllowed('past', 'attended'), true);
    assert.equal(rsvpAllowed('upcoming', 'attended'), false);
  });
});
