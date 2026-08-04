// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { start } from '../src/content/meet-auto-join.js';
import { PANEL_ID } from '../src/content/meet-panel.js';

const MEETING_URL = 'https://meet.google.com/abc-defg-hij';

function at(hours, minutes, seconds = 0) {
  return new Date(2026, 0, 15, hours, minutes, seconds);
}

let time;
let url;
let joinButton;
let settingsListener;
let running;

function panel() {
  return document.getElementById(PANEL_ID);
}

function panelText(selector) {
  return panel()?.shadowRoot.querySelector(selector)?.textContent ?? null;
}

/** Boot the content script with the clock, the URL and the settings under test. */
async function run(settings = { enabled: true, intervalMinutes: 15 }) {
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
async function tick(next) {
  if (next) time = next;
  await vi.advanceTimersByTimeAsync(1000);
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
  time = at(10, 7);
  url = MEETING_URL;
  joinButton = { click: vi.fn() };
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

    expect(joinButton.click).toHaveBeenCalledTimes(1);
    expect(panelText('.message')).toBe('参加しました');
    expect(panelText('.countdown')).toBe('');
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

    panel().shadowRoot.querySelector('.cancel').click();
    expect(panelText('.message')).toBe('自動入室をキャンセルしました');

    await tick(at(10, 15));
    expect(joinButton.click).not.toHaveBeenCalled();
  });

  it('does nothing while the feature is off', async () => {
    await run({ enabled: false, intervalMinutes: 15 });
    await tick(at(10, 15));

    expect(panel()).toBeNull();
    expect(joinButton.click).not.toHaveBeenCalled();
  });

  it('stays out of the way on pages that are not a meeting', async () => {
    url = 'https://meet.google.com/';
    await run();
    await tick(at(10, 15));

    expect(panel()).toBeNull();
    expect(joinButton.click).not.toHaveBeenCalled();
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
    expect(joinButton.click).toHaveBeenCalledTimes(1);

    url = 'https://meet.google.com/klm-nopq-rst';
    await tick(at(10, 16));
    expect(panelText('.message')).toBe('10:30 に自動で参加します');
  });

  it('takes the panel down when the feature is switched off', async () => {
    await run();
    expect(panel()).toBeTruthy();

    settingsListener({ enabled: false, intervalMinutes: 15 });
    expect(panel()).toBeNull();

    await tick(at(10, 15));
    expect(joinButton.click).not.toHaveBeenCalled();
  });

  it('picks up a countdown when the feature is switched on', async () => {
    await run({ enabled: false, intervalMinutes: 15 });
    expect(panel()).toBeNull();

    settingsListener({ enabled: true, intervalMinutes: 30 });
    expect(panelText('.message')).toBe('10:30 に自動で参加します');
  });

  it('waits for a join button that Meet has not rendered yet', async () => {
    joinButton = null;
    await run();

    await tick(at(10, 15));
    expect(panelText('.message')).toBe('10:15 に自動で参加します');

    joinButton = { click: vi.fn() };
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
    running.stop();
    running = null;

    expect(panel()).toBeNull();
    await tick(at(10, 15));
    expect(joinButton.click).not.toHaveBeenCalled();
  });
});
