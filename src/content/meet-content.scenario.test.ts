import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { start, type Running } from './meet-auto-join';
import { PANEL_ID } from './meet-panel';
import type { MeetSettings } from '../lib/types';

const MEETING_URL = 'https://meet.google.com/abc-defg-hij';

function at(hours: number, minutes: number, seconds = 0): Date {
  return new Date(2026, 0, 15, hours, minutes, seconds);
}

let time: Date;
let url: string;
let joinButton: { click: Mock<() => void> } | null;
let settingsListener: ((settings: MeetSettings) => void) | undefined;
let running: Running | null;

function panel(): HTMLElement | null {
  return document.getElementById(PANEL_ID);
}

function panelText(selector: string): string | null {
  return panel()?.shadowRoot?.querySelector(selector)?.textContent ?? null;
}

function cancelButton(): HTMLElement | null {
  return panel()?.shadowRoot?.querySelector<HTMLElement>('.cancel') ?? null;
}

function postponeButton(): HTMLElement | null {
  return panel()?.shadowRoot?.querySelector<HTMLElement>('.postpone') ?? null;
}

function hastenButton(): HTMLButtonElement | null {
  return panel()?.shadowRoot?.querySelector<HTMLButtonElement>('.hasten') ?? null;
}

/** Boot the content script with the clock, the URL and the settings under test. */
async function run(settings: MeetSettings = { enabled: true, intervalMinutes: 15 }) {
  running = start({
    document,
    getUrl: () => url,
    loadSettings: async () => settings,
    onSettingsChanged: (cb) => {
      settingsListener = cb;
    },
    findButton: () => joinButton,
    now: () => time,
    tickMs: 1000,
    urlPollMs: 1000,
    dismissMs: 6000,
  });
  await running.ready;
}

/** Move the clock and let the content script's interval fire once. */
async function tick(next?: Date) {
  if (next) time = next;
  await vi.advanceTimersByTimeAsync(1000);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  time = at(10, 7);
  url = MEETING_URL;
  joinButton = { click: vi.fn<() => void>() };
  settingsListener = undefined;
  running = null;
});

afterEach(() => {
  running?.stop();
  vi.useRealTimers();
});

describe('meet content script', () => {
  it('shows the countdown panel on a meeting page', async () => {
    await run();

    expect(panel()).toBeTruthy();
    expect(panelText('.message')).toBe('10:15 に自動で参加します');
    expect(panelText('.countdown')).toBe('残り 08:00');
  });

  it('counts down as time passes', async () => {
    await run();
    await tick(at(10, 14, 30));
    expect(panelText('.countdown')).toBe('残り 00:30');
  });

  it('clicks the join button at the slot boundary', async () => {
    await run();
    await tick(at(10, 15));

    expect(joinButton?.click).toHaveBeenCalledTimes(1);
    expect(panelText('.message')).toBe('参加しました');
    expect(panelText('.countdown')).toBeNull();
  });

  it('removes the panel a moment after joining', async () => {
    await run();
    await tick(at(10, 15));
    expect(panel()).toBeTruthy();

    await vi.advanceTimersByTimeAsync(6000);
    expect(panel()).toBeNull();
  });

  it('does not join after the user cancels', async () => {
    await run();

    cancelButton()?.click();
    expect(panelText('.message')).toBe('自動入室をキャンセルしました');

    await tick(at(10, 15));
    expect(joinButton?.click).not.toHaveBeenCalled();
  });

  it('waits another minute when +1分 is clicked', async () => {
    await run();

    postponeButton()?.click();
    expect(panelText('.message')).toBe('10:16 に自動で参加します');
    expect(panelText('.countdown')).toBe('残り 09:00');

    await tick(at(10, 15));
    expect(joinButton?.click).not.toHaveBeenCalled();

    await tick(at(10, 16));
    expect(joinButton?.click).toHaveBeenCalledTimes(1);
  });

  it('joins a minute earlier when -1分 is clicked', async () => {
    await run();

    hastenButton()?.click();
    expect(panelText('.message')).toBe('10:14 に自動で参加します');
    expect(panelText('.countdown')).toBe('残り 07:00');

    await tick(at(10, 14));
    expect(joinButton?.click).toHaveBeenCalledTimes(1);
  });

  it('greys out -1分 while it waits for a join button Meet has not shown', async () => {
    joinButton = null;
    await run();
    expect(hastenButton()?.disabled).toBe(false);

    await tick(at(10, 15));
    expect(hastenButton()?.disabled).toBe(true);
  });

  it('hides +1分 once the countdown is over', async () => {
    await run();
    expect((postponeButton() as HTMLElement).hidden).toBe(false);

    await tick(at(10, 15));
    expect((postponeButton() as HTMLElement).hidden).toBe(true);
  });

  it('takes the cancelled panel down as soon as it is clicked', async () => {
    await run();

    cancelButton()?.click();
    expect(panelText('.message')).toBe('自動入室をキャンセルしました');

    panel()?.shadowRoot?.querySelector<HTMLElement>('.panel')?.click();
    expect(panel()).toBeNull();

    // The dismiss timer that was already running must not trip over the
    // session the click took away.
    await vi.advanceTimersByTimeAsync(6000);
    expect(panel()).toBeNull();
  });

  it('leaves the countdown alone when the panel is clicked while waiting', async () => {
    await run();

    panel()?.shadowRoot?.querySelector<HTMLElement>('.panel')?.click();

    expect(panel()).toBeTruthy();
    await tick(at(10, 15));
    expect(joinButton?.click).toHaveBeenCalledTimes(1);
  });

  it('hides the cancel button once the countdown is over', async () => {
    await run();
    expect((cancelButton() as HTMLElement).hidden).toBe(false);

    await tick(at(10, 15));
    expect((cancelButton() as HTMLElement).hidden).toBe(true);
  });

  it('does nothing while the feature is off', async () => {
    await run({ enabled: false, intervalMinutes: 15 });
    await tick(at(10, 15));

    expect(panel()).toBeNull();
    expect(joinButton?.click).not.toHaveBeenCalled();
  });

  it('stays out of the way on pages that are not a meeting', async () => {
    url = 'https://meet.google.com/';
    await run();
    await tick(at(10, 15));

    expect(panel()).toBeNull();
    expect(joinButton?.click).not.toHaveBeenCalled();
  });

  it('starts once the single page app navigates into a meeting', async () => {
    url = 'https://meet.google.com/';
    await run();
    expect(panel()).toBeNull();

    url = MEETING_URL;
    await tick();
    expect(panel()).toBeTruthy();
  });

  it('restarts the countdown when another meeting is opened', async () => {
    await run();
    await tick(at(10, 15));
    expect(joinButton?.click).toHaveBeenCalledTimes(1);

    url = 'https://meet.google.com/klm-nopq-rst';
    await tick(at(10, 16));
    expect(panelText('.message')).toBe('10:30 に自動で参加します');
  });

  it('takes the panel down when the feature is switched off', async () => {
    await run();
    expect(panel()).toBeTruthy();

    settingsListener?.({ enabled: false, intervalMinutes: 15 });
    expect(panel()).toBeNull();

    await tick(at(10, 15));
    expect(joinButton?.click).not.toHaveBeenCalled();
  });

  it('re-targets the countdown when the interval is changed', async () => {
    await run();
    expect(panelText('.message')).toBe('10:15 に自動で参加します');

    settingsListener?.({ enabled: true, intervalMinutes: 30 });
    expect(panelText('.message')).toBe('10:30 に自動で参加します');
  });

  it('leaves a running countdown alone when only the toggle is re-sent', async () => {
    await run();
    await tick(at(10, 10));
    expect(panelText('.countdown')).toBe('残り 05:00');

    settingsListener?.({ enabled: true, intervalMinutes: 15 });
    expect(panelText('.countdown')).toBe('残り 05:00');
  });

  it('picks up a countdown when the feature is switched on', async () => {
    await run({ enabled: false, intervalMinutes: 15 });
    expect(panel()).toBeNull();

    settingsListener?.({ enabled: true, intervalMinutes: 30 });
    expect(panelText('.message')).toBe('10:30 に自動で参加します');
  });

  it('waits for a join button that Meet has not rendered yet', async () => {
    joinButton = null;
    await run();

    await tick(at(10, 15));
    expect(panelText('.message')).toBe('10:15 に自動で参加します');

    joinButton = { click: vi.fn<() => void>() };
    await tick(at(10, 15, 10));
    expect(joinButton.click).toHaveBeenCalledTimes(1);
  });

  it('reports that the join button never showed up', async () => {
    joinButton = null;
    await run();

    await tick(at(10, 18));
    expect(panelText('.message')).toBe('参加ボタンが見つかりませんでした');
  });

  it('stops cleanly', async () => {
    await run();
    running?.stop();
    running = null;

    expect(panel()).toBeNull();
    await tick(at(10, 15));
    expect(joinButton?.click).not.toHaveBeenCalled();
  });
});
