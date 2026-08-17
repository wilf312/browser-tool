import { describe, it, expect } from 'vitest';
import { DEFAULT_INTERVAL_MINUTES, nextSlot, normalizeIntervalMinutes } from './meet-schedule';

/** Local time, so the assertions match what the user sees on the clock. */
function at(hours: number, minutes: number, seconds = 0, ms = 0): Date {
  return new Date(2026, 0, 15, hours, minutes, seconds, ms);
}

describe('nextSlot', () => {
  it('jumps to the next quarter of an hour', () => {
    expect(nextSlot(at(10, 7))).toEqual(at(10, 15));
    expect(nextSlot(at(10, 16))).toEqual(at(10, 30));
    expect(nextSlot(at(10, 31))).toEqual(at(10, 45));
  });

  it('rolls over into the next hour', () => {
    expect(nextSlot(at(10, 46))).toEqual(at(11, 0));
  });

  it('rolls over into the next day', () => {
    expect(nextSlot(new Date(2026, 0, 15, 23, 52))).toEqual(new Date(2026, 0, 16, 0, 0));
  });

  it('never returns the boundary that just passed', () => {
    expect(nextSlot(at(10, 15, 0, 0))).toEqual(at(10, 30));
    expect(nextSlot(at(10, 15, 0, 1))).toEqual(at(10, 30));
  });

  it('drops the seconds and milliseconds of the current time', () => {
    const slot = nextSlot(at(10, 7, 42, 500));
    expect(slot.getSeconds()).toBe(0);
    expect(slot.getMilliseconds()).toBe(0);
  });

  it('honours other intervals', () => {
    expect(nextSlot(at(10, 7), 30)).toEqual(at(10, 30));
    expect(nextSlot(at(10, 31), 30)).toEqual(at(11, 0));
    expect(nextSlot(at(10, 7), 5)).toEqual(at(10, 10));
    expect(nextSlot(at(10, 7), 60)).toEqual(at(11, 0));
  });

  it('falls back to the default interval for junk', () => {
    expect(nextSlot(at(10, 7), 'abc' as unknown as number)).toEqual(at(10, 15));
  });
});

describe('normalizeIntervalMinutes', () => {
  it('keeps sensible values', () => {
    expect(normalizeIntervalMinutes(5)).toBe(5);
    expect(normalizeIntervalMinutes('30')).toBe(30);
  });

  it('falls back to the default for anything unusable', () => {
    for (const value of [undefined, null, 0, -5, NaN, 'abc', {}]) {
      expect(normalizeIntervalMinutes(value)).toBe(DEFAULT_INTERVAL_MINUTES);
    }
  });

  it('caps the interval at an hour', () => {
    expect(normalizeIntervalMinutes(120)).toBe(60);
  });
});
