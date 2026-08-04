import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INTERVAL_MINUTES,
  formatClock,
  formatCountdown,
  nextSlot,
  normalizeIntervalMinutes,
} from '../src/lib/meet-schedule';

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

describe('formatClock', () => {
  it('pads to hh:mm', () => {
    expect(formatClock(at(9, 5))).toBe('09:05');
    expect(formatClock(at(23, 45))).toBe('23:45');
  });
});

describe('formatCountdown', () => {
  it('formats mm:ss', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(5_000)).toBe('00:05');
    expect(formatCountdown(222_000)).toBe('03:42');
  });

  it('adds the hours once there is at least one', () => {
    expect(formatCountdown(3_723_000)).toBe('1:02:03');
  });

  it('rounds up, so the last second is not shown as 00:00', () => {
    expect(formatCountdown(1_500)).toBe('00:02');
  });

  it('never goes negative', () => {
    expect(formatCountdown(-5_000)).toBe('00:00');
  });
});
