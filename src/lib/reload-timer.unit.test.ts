import { describe, it, expect } from 'vitest';
import {
  createReloadJob,
  DEFAULT_RELOAD_DURATION_MINUTES,
  DEFAULT_RELOAD_INTERVAL_SECONDS,
  formatDurationLabel,
  formatIntervalLabel,
  nextReloadAt,
  normalizeDurationMinutes,
  normalizeIntervalSeconds,
  RELOAD_GRACE_MS,
  reloadProgress,
  sanitizeReloadJob,
  shouldReloadNow,
} from './reload-timer';
import type { ReloadJob } from './types';

const START = new Date(2026, 0, 15, 10, 0, 0).getTime();

/** A minute apart, for ten minutes. */
function job(overrides: Partial<ReloadJob> = {}): ReloadJob {
  return {
    tabId: 7,
    intervalSeconds: 60,
    startedAt: START,
    endsAt: START + 10 * 60_000,
    ...overrides,
  };
}

/** `START` plus this many seconds. */
function after(seconds: number): Date {
  return new Date(START + seconds * 1000);
}

describe('normalizeIntervalSeconds', () => {
  it('keeps sensible values', () => {
    expect(normalizeIntervalSeconds(30)).toBe(30);
    expect(normalizeIntervalSeconds('300')).toBe(300);
  });

  it('falls back to the default for anything unusable', () => {
    for (const value of [undefined, null, 0, -30, NaN, 'abc', {}]) {
      expect(normalizeIntervalSeconds(value)).toBe(DEFAULT_RELOAD_INTERVAL_SECONDS);
    }
  });

  it('falls back for anything Chrome would not fire that often', () => {
    expect(normalizeIntervalSeconds(5)).toBe(DEFAULT_RELOAD_INTERVAL_SECONDS);
  });

  it('caps the interval at an hour', () => {
    expect(normalizeIntervalSeconds(7200)).toBe(3600);
  });
});

describe('normalizeDurationMinutes', () => {
  it('keeps sensible values', () => {
    expect(normalizeDurationMinutes(5)).toBe(5);
    expect(normalizeDurationMinutes('180')).toBe(180);
  });

  it('falls back to the default for anything unusable', () => {
    for (const value of [undefined, null, 0, -5, NaN, 'abc', {}]) {
      expect(normalizeDurationMinutes(value)).toBe(DEFAULT_RELOAD_DURATION_MINUTES);
    }
  });

  it('caps the duration at a day', () => {
    expect(normalizeDurationMinutes(10_000)).toBe(1440);
  });
});

describe('createReloadJob', () => {
  it('spans the requested duration from now', () => {
    const created = createReloadJob({
      tabId: 4,
      intervalSeconds: 30,
      durationMinutes: 5,
      now: new Date(START),
    });

    expect(created).toEqual({
      tabId: 4,
      intervalSeconds: 30,
      startedAt: START,
      endsAt: START + 5 * 60_000,
    });
  });

  it('normalizes what it is handed', () => {
    const created = createReloadJob({
      tabId: 4,
      intervalSeconds: 1,
      durationMinutes: 'abc',
      now: new Date(START),
    });

    expect(created.intervalSeconds).toBe(DEFAULT_RELOAD_INTERVAL_SECONDS);
    expect(created.endsAt).toBe(START + DEFAULT_RELOAD_DURATION_MINUTES * 60_000);
  });
});

describe('sanitizeReloadJob', () => {
  it('keeps a well formed job', () => {
    expect(sanitizeReloadJob(job())).toEqual(job());
  });

  it('repairs an unusable interval', () => {
    expect(sanitizeReloadJob({ ...job(), intervalSeconds: 0 })?.intervalSeconds).toBe(
      DEFAULT_RELOAD_INTERVAL_SECONDS,
    );
  });

  it('refuses anything that is not a job', () => {
    for (const value of [undefined, null, 0, 'abc', [], {}]) {
      expect(sanitizeReloadJob(value)).toBeNull();
    }
  });

  it('refuses a job without a usable tab or times', () => {
    expect(sanitizeReloadJob({ ...job(), tabId: 'x' })).toBeNull();
    expect(sanitizeReloadJob({ ...job(), startedAt: NaN })).toBeNull();
    expect(sanitizeReloadJob({ ...job(), endsAt: undefined })).toBeNull();
  });

  it('refuses a window that ends before it starts', () => {
    expect(sanitizeReloadJob({ ...job(), endsAt: START })).toBeNull();
  });
});

describe('nextReloadAt', () => {
  it('is one interval after the start to begin with', () => {
    expect(nextReloadAt(job(), after(0))).toBe(START + 60_000);
  });

  it('moves to the boundary after the current moment', () => {
    expect(nextReloadAt(job(), after(59))).toBe(START + 60_000);
    expect(nextReloadAt(job(), after(60))).toBe(START + 120_000);
    expect(nextReloadAt(job(), after(61))).toBe(START + 120_000);
  });

  it('is not thrown off by a clock that reads before the start', () => {
    expect(nextReloadAt(job(), new Date(START - 5_000))).toBe(START + 60_000);
  });
});

describe('shouldReloadNow', () => {
  it('reloads while the window is open', () => {
    expect(shouldReloadNow(job(), after(60))).toBe(true);
    expect(shouldReloadNow(job(), after(9 * 60))).toBe(true);
  });

  it('still reloads on the boundary that ends the window', () => {
    expect(shouldReloadNow(job(), after(10 * 60))).toBe(true);
  });

  it('tolerates an alarm that fires a little late', () => {
    expect(shouldReloadNow(job(), new Date(START + 10 * 60_000 + RELOAD_GRACE_MS))).toBe(true);
  });

  it('stops once the window is over', () => {
    expect(shouldReloadNow(job(), new Date(START + 10 * 60_000 + RELOAD_GRACE_MS + 1))).toBe(false);
  });
});

describe('reloadProgress', () => {
  it('counts down to the end and to the next reload', () => {
    expect(reloadProgress(job(), after(90))).toEqual({
      remainingMs: 8 * 60_000 + 30_000,
      nextInMs: 30_000,
      done: false,
    });
  });

  it('still counts the reload that lands on the end of the window', () => {
    expect(reloadProgress(job(), after(10 * 60 - 10)).nextInMs).toBe(10_000);
  });

  it('reports no next reload once the last one has been and gone', () => {
    // The window ends half a minute after the tenth reload, so there is no eleventh.
    const trailing = job({ endsAt: START + 10 * 60_000 + 30_000 });
    const progress = reloadProgress(trailing, after(10 * 60 + 1));

    expect(progress.done).toBe(false);
    expect(progress.remainingMs).toBe(29_000);
    expect(progress.nextInMs).toBeNull();
  });

  it('is done once the window is over', () => {
    expect(reloadProgress(job(), after(10 * 60))).toEqual({
      remainingMs: 0,
      nextInMs: null,
      done: true,
    });
  });
});

describe('formatIntervalLabel', () => {
  it('reads in seconds below a minute and in minutes above it', () => {
    expect(formatIntervalLabel(30)).toBe('30 秒');
    expect(formatIntervalLabel(60)).toBe('1 分');
    expect(formatIntervalLabel(1800)).toBe('30 分');
  });
});

describe('formatDurationLabel', () => {
  it('reads in minutes, hours, or both', () => {
    expect(formatDurationLabel(30)).toBe('30 分');
    expect(formatDurationLabel(60)).toBe('1 時間');
    expect(formatDurationLabel(480)).toBe('8 時間');
    expect(formatDurationLabel(90)).toBe('1 時間 30 分');
  });
});
