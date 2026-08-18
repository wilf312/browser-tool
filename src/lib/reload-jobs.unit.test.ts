import { describe, it, expect, afterEach } from 'vitest';
import {
  loadReloadJob,
  loadReloadJobs,
  RELOAD_JOBS_KEY,
  reloadAlarmName,
  runReloadAlarm,
  startReloadJob,
  stopReloadJob,
  tabIdFromAlarmName,
} from './reload-jobs';
import { RELOAD_GRACE_MS } from './reload-timer';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';
import type { ReloadJob } from './types';

const START = new Date(2026, 0, 15, 10, 0, 0).getTime();

function job(overrides: Partial<ReloadJob> = {}): ReloadJob {
  return {
    tabId: 7,
    intervalSeconds: 60,
    startedAt: START,
    endsAt: START + 10 * 60_000,
    ...overrides,
  };
}

/** A fake browser that already has the given jobs running. */
function withJobs(...jobs: ReloadJob[]): FakeChrome {
  const stored = Object.fromEntries(jobs.map((current) => [current.tabId, current]));
  return installFakeChrome({ session: { [RELOAD_JOBS_KEY]: stored } });
}

function storedJobs(chrome: FakeChrome): Record<string, unknown> {
  return chrome.sessionStore[RELOAD_JOBS_KEY] as Record<string, unknown>;
}

afterEach(() => {
  uninstallFakeChrome();
});

describe('alarm names', () => {
  it('round trips the tab id', () => {
    expect(tabIdFromAlarmName(reloadAlarmName(12))).toBe(12);
  });

  it('ignores an alarm that is not a reload timer', () => {
    expect(tabIdFromAlarmName('something-else')).toBeNull();
    expect(tabIdFromAlarmName('reload-timer:abc')).toBeNull();
  });
});

describe('loadReloadJobs', () => {
  it('reads the running jobs back', async () => {
    withJobs(job(), job({ tabId: 9 }));

    await expect(loadReloadJobs()).resolves.toEqual({ 7: job(), 9: job({ tabId: 9 }) });
  });

  it('drops entries that are not jobs', async () => {
    installFakeChrome({ session: { [RELOAD_JOBS_KEY]: { 7: job(), 9: 'nonsense' } } });

    await expect(loadReloadJobs()).resolves.toEqual({ 7: job() });
  });

  it('is empty when nothing is stored, or when the value is not a map', async () => {
    installFakeChrome();
    await expect(loadReloadJobs()).resolves.toEqual({});

    installFakeChrome({ session: { [RELOAD_JOBS_KEY]: [1, 2] } });
    await expect(loadReloadJobs()).resolves.toEqual({});
  });
});

describe('loadReloadJob', () => {
  it('finds the job of one tab', async () => {
    withJobs(job());

    await expect(loadReloadJob(7)).resolves.toEqual(job());
  });

  it('is null for a tab without a timer', async () => {
    withJobs(job());

    await expect(loadReloadJob(8)).resolves.toBeNull();
  });
});

describe('startReloadJob', () => {
  it('stores the job and sets the alarm that drives it', async () => {
    const chrome = installFakeChrome();

    const started = await startReloadJob({
      tabId: 7,
      intervalSeconds: 30,
      durationMinutes: 5,
      now: new Date(START),
    });

    expect(started).toEqual({
      tabId: 7,
      intervalSeconds: 30,
      startedAt: START,
      endsAt: START + 5 * 60_000,
    });
    expect(storedJobs(chrome)).toEqual({ 7: started });
    expect(chrome.alarmStore.get(reloadAlarmName(7))).toEqual({
      when: START + 30_000,
      periodInMinutes: 0.5,
    });
  });

  it('leaves the timers of other tabs alone', async () => {
    const chrome = withJobs(job({ tabId: 9 }));

    await startReloadJob({ tabId: 7, now: new Date(START) });

    expect(Object.keys(storedJobs(chrome))).toEqual(['7', '9']);
  });

  it('replaces the timer a tab already had', async () => {
    const chrome = withJobs(job());

    await startReloadJob({ tabId: 7, durationMinutes: 5, now: new Date(START) });

    expect(storedJobs(chrome)[7]).toMatchObject({ endsAt: START + 5 * 60_000 });
  });
});

describe('stopReloadJob', () => {
  it('drops the job and clears the alarm', async () => {
    const chrome = withJobs(job(), job({ tabId: 9 }));

    await stopReloadJob(7);

    expect(storedJobs(chrome)).toEqual({ 9: job({ tabId: 9 }) });
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });

  it('still clears the alarm of a tab that has no job', async () => {
    const chrome = installFakeChrome();

    await stopReloadJob(7);

    expect(chrome.session.set).not.toHaveBeenCalled();
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });
});

describe('runReloadAlarm', () => {
  it('reloads the tab while the window is open', async () => {
    const chrome = withJobs(job());

    await runReloadAlarm(reloadAlarmName(7), new Date(START + 60_000));

    expect(chrome.tabs.reload).toHaveBeenCalledWith(7);
    expect(chrome.alarms.clear).not.toHaveBeenCalled();
  });

  it('stops once the window is over', async () => {
    const chrome = withJobs(job());

    await runReloadAlarm(reloadAlarmName(7), new Date(START + 10 * 60_000 + RELOAD_GRACE_MS + 1));

    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(storedJobs(chrome)).toEqual({});
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });

  it('clears an alarm left over from a previous browser session', async () => {
    const chrome = installFakeChrome();

    await runReloadAlarm(reloadAlarmName(7), new Date(START));

    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });

  it('stops when the tab cannot be reloaded any more', async () => {
    const chrome = withJobs(job());
    chrome.tabs.reload.mockRejectedValue(new Error('No tab with id: 7'));

    await runReloadAlarm(reloadAlarmName(7), new Date(START + 60_000));

    expect(storedJobs(chrome)).toEqual({});
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });

  it('ignores an alarm that belongs to something else', async () => {
    const chrome = withJobs(job());

    await runReloadAlarm('some-other-alarm', new Date(START + 60_000));

    expect(chrome.tabs.reload).not.toHaveBeenCalled();
    expect(chrome.alarms.clear).not.toHaveBeenCalled();
  });
});
