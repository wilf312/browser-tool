import { describe, it, expect } from 'vitest';
import { formatClock, formatCountdown } from './format-time';

/** Local time, so the assertions match what the user sees on the clock. */
function at(hours: number, minutes: number): Date {
  return new Date(2026, 0, 15, hours, minutes);
}

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
