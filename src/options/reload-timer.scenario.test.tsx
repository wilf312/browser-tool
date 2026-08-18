/**
 * The reload timer as it is driven from the popup: pick an interval and a
 * duration, start it on the tab that is on screen, and find it still counting
 * down the next time the popup is opened.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { App } from './App';
import { RELOAD_JOBS_KEY, reloadAlarmName } from '../lib/reload-jobs';
import { RELOAD_SETTINGS_KEY } from '../lib/reload-settings';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';
import type { ReloadJob } from '../lib/types';

const NOW = new Date(2026, 0, 15, 10, 0, 0);
const TAB = { id: 7, url: 'https://example.com/board', title: 'Board' };

let chrome: FakeChrome;

/** Open the settings page as the popup over `TAB` and wait for the lookups to settle. */
async function mount(session: Record<string, unknown> = {}, storage: Record<string, unknown> = {}) {
  chrome = installFakeChrome({ activeTab: TAB, session, storage });
  render(<App />);
  await act(async () => {});
}

function storedJobs(): Record<string, ReloadJob> {
  return (chrome.sessionStore[RELOAD_JOBS_KEY] ?? {}) as Record<string, ReloadJob>;
}

function progress(): string {
  return document.querySelector('#reload-progress')?.textContent ?? '';
}

async function click(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }));
  });
}

/** The labels a dropdown offers, top to bottom. */
function optionLabels(label: string): string[] {
  return [...screen.getByLabelText<HTMLSelectElement>(label).options].map((option) => option.text);
}

/** Let the countdown redraw. */
async function tick(seconds: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(seconds * 1000);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  uninstallFakeChrome();
});

describe('reload timer', () => {
  it('offers to start a timer on the tab that is on screen', async () => {
    await mount();

    expect(screen.getByText(TAB.url)).toBeTruthy();
    expect(screen.getByRole('button', { name: '開始' })).toBeTruthy();
  });

  it('starts with the defaults', async () => {
    await mount();

    expect(screen.getByLabelText<HTMLSelectElement>('リロード間隔').value).toBe('300');
    expect(screen.getByLabelText<HTMLSelectElement>('続ける時間').value).toBe('60');
  });

  it('offers the values that were picked last time', async () => {
    await mount({}, { [RELOAD_SETTINGS_KEY]: { intervalSeconds: 1800, durationMinutes: 480 } });

    expect(screen.getByLabelText<HTMLSelectElement>('リロード間隔').value).toBe('1800');
    expect(screen.getByLabelText<HTMLSelectElement>('続ける時間').value).toBe('480');
  });

  it('offers only the three intervals and the eight durations', async () => {
    await mount();

    expect(optionLabels('リロード間隔')).toEqual(['5 分', '10 分', '30 分']);
    expect(optionLabels('続ける時間')).toEqual([
      '1 時間',
      '2 時間',
      '3 時間',
      '4 時間',
      '5 時間',
      '6 時間',
      '7 時間',
      '8 時間',
    ]);
  });

  it('offers a stored value that is not one of the usual choices', async () => {
    await mount({}, { [RELOAD_SETTINGS_KEY]: { intervalSeconds: 900, durationMinutes: 90 } });

    const interval = screen.getByLabelText<HTMLSelectElement>('リロード間隔');
    expect(interval.value).toBe('900');
    expect([...interval.options].map((option) => option.value)).toEqual([
      '300',
      '600',
      '900',
      '1800',
    ]);

    const duration = screen.getByLabelText<HTMLSelectElement>('続ける時間');
    expect(duration.value).toBe('90');
    expect([...duration.options][0].value).toBe('60');
    expect([...duration.options][1].value).toBe('90');
  });

  it('remembers the values that were picked', async () => {
    await mount();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('リロード間隔'), { target: { value: '1800' } });
    });

    expect(chrome.store[RELOAD_SETTINGS_KEY]).toEqual({
      intervalSeconds: 1800,
      durationMinutes: 60,
    });
  });

  it('stores the job and sets the alarm when it is started', async () => {
    await mount();

    await act(async () => {
      fireEvent.change(screen.getByLabelText('リロード間隔'), { target: { value: '600' } });
      fireEvent.change(screen.getByLabelText('続ける時間'), { target: { value: '240' } });
    });
    await click('開始');

    const job = storedJobs()[7];
    expect(job).toMatchObject({ tabId: 7, intervalSeconds: 600 });
    expect(job.endsAt - job.startedAt).toBe(240 * 60_000);
    expect(chrome.alarmStore.get(reloadAlarmName(7))).toEqual({
      when: job.startedAt + 600_000,
      periodInMinutes: 10,
    });
  });

  it('counts down to the end and to the next reload', async () => {
    await mount();

    await click('開始');

    expect(progress()).toContain('5 分 ごとにリロードしています');
    expect(progress()).toContain('終了まで 1:00:00');
    expect(progress()).toContain('次まで 05:00');

    await tick(20);

    expect(progress()).toContain('終了まで 59:40');
    expect(progress()).toContain('次まで 04:40');
  });

  it('picks a running timer back up when the popup is opened again', async () => {
    const startedAt = NOW.getTime() - 90_000;
    await mount({
      [RELOAD_JOBS_KEY]: {
        7: { tabId: 7, intervalSeconds: 60, startedAt, endsAt: startedAt + 10 * 60_000 },
      },
    });

    expect(progress()).toContain('終了まで 08:30');
    expect(screen.queryByRole('button', { name: '開始' })).toBeNull();
  });

  it('ignores a timer that belongs to another tab', async () => {
    await mount({
      [RELOAD_JOBS_KEY]: {
        9: {
          tabId: 9,
          intervalSeconds: 60,
          startedAt: NOW.getTime(),
          endsAt: NOW.getTime() + 1000,
        },
      },
    });

    expect(screen.getByRole('button', { name: '開始' })).toBeTruthy();
  });

  it('drops the job and the alarm when it is stopped', async () => {
    await mount();
    await click('開始');

    await click('停止');

    expect(storedJobs()).toEqual({});
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
    expect(screen.getByRole('button', { name: '開始' })).toBeTruthy();
  });

  it('offers to start again once the window is over', async () => {
    const startedAt = NOW.getTime() - 60_000;
    await mount({
      [RELOAD_JOBS_KEY]: {
        7: { tabId: 7, intervalSeconds: 30, startedAt, endsAt: startedAt + 62_000 },
      },
    });
    expect(screen.queryByRole('button', { name: '開始' })).toBeNull();

    await tick(3);

    expect(screen.getByRole('button', { name: '開始' })).toBeTruthy();
  });

  it('names the tab by its title, or not at all, when there is no URL to show', async () => {
    chrome = installFakeChrome({ activeTab: { id: 7, title: 'Board' } });
    render(<App />);
    await act(async () => {});
    expect(screen.getByText('Board')).toBeTruthy();

    uninstallFakeChrome();
    chrome = installFakeChrome({ activeTab: { id: 7 } });
    render(<App />);
    await act(async () => {});
    expect(screen.getByText('このタブ')).toBeTruthy();
  });

  it('logs instead of throwing when the picked values cannot be saved', async () => {
    await mount();
    const error = new Error('sync quota exceeded');
    chrome.sync.set.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await act(async () => {
      fireEvent.change(screen.getByLabelText('リロード間隔'), { target: { value: '1800' } });
    });

    // The dropdown still moved, so the timer can be started with what was picked.
    expect(screen.getByLabelText<HTMLSelectElement>('リロード間隔').value).toBe('1800');
    expect(logged.mock.calls[0]).toContain(error);
  });

  it('picks up values changed in another context', async () => {
    await mount();

    await act(async () => {
      chrome.emitChange(RELOAD_SETTINGS_KEY, { intervalSeconds: 600, durationMinutes: 480 });
    });

    expect(screen.getByText('10 分ごと / 8 時間')).toBeTruthy();
  });

  it('says there is no tab to reload when the settings page has a tab of its own', async () => {
    chrome = installFakeChrome({
      activeTab: TAB,
      currentTab: { id: 9, url: 'chrome-extension://abc/options.html' },
    });
    render(<App />);
    await act(async () => {});

    expect(screen.getByText(/対象のタブが見つかりません/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: '開始' })).toBeNull();
  });

  it('reports a timer it could not start', async () => {
    await mount();
    const error = new Error('session storage is full');
    chrome.session.set.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await click('開始');

    expect(screen.getByText('開始できませんでした')).toBeTruthy();
    expect(logged.mock.calls[0]).toContain(error);
  });

  it('reports a timer it could not stop', async () => {
    await mount();
    await click('開始');
    const error = new Error('alarms are unavailable');
    chrome.alarms.clear.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await click('停止');

    expect(screen.getByText('停止できませんでした')).toBeTruthy();
    expect(logged.mock.calls[0]).toContain(error);
  });
});
