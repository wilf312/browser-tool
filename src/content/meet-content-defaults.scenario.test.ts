/**
 * `start()` is driven with explicit collaborators everywhere else, so its own
 * defaults — the real document, clock, storage and join-button lookup — never
 * run. This is the wiring that actually ships on the Meet page.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { start, type Running } from './meet-auto-join';
import { PANEL_ID } from './meet-panel';
import { MEET_SETTINGS_KEY } from '../lib/meet-settings';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';

const MEETING_URL = 'https://meet.google.com/abc-defg-hij';

function at(hours: number, minutes: number, seconds = 0): Date {
  return new Date(2026, 0, 15, hours, minutes, seconds);
}

let chrome: FakeChrome;
let running: Running | null;

function panel(): HTMLElement | null {
  return document.getElementById(PANEL_ID);
}

function panelText(selector: string): string | null {
  return panel()?.shadowRoot?.querySelector(selector)?.textContent ?? null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(at(10, 7));
  document.body.innerHTML = '';
  running = null;
  chrome = installFakeChrome({
    storage: { [MEET_SETTINGS_KEY]: { enabled: true, intervalMinutes: 15 } },
  });
});

afterEach(() => {
  running?.stop();
  vi.useRealTimers();
  uninstallFakeChrome();
});

describe('start with its own defaults', () => {
  it('reads the settings from storage and counts down on the real clock', async () => {
    running = start({ getUrl: () => MEETING_URL });
    await running.ready;

    expect(chrome.sync.get).toHaveBeenCalledWith(MEET_SETTINGS_KEY);
    expect(panelText('.message')).toBe('10:15 に自動で参加します');
    expect(panelText('.countdown')).toBe('残り 08:00');
  });

  it('clicks the real join button it finds in the page', async () => {
    const button = document.createElement('button');
    button.textContent = '今すぐ参加';
    const clicked = vi.fn();
    button.addEventListener('click', clicked);
    document.body.append(button);

    running = start({ getUrl: () => MEETING_URL });
    await running.ready;

    vi.setSystemTime(at(10, 15));
    await vi.advanceTimersByTimeAsync(1000);

    expect(clicked).toHaveBeenCalledTimes(1);
    expect(panelText('.message')).toBe('参加しました');
  });

  it('follows the settings written by the options page', async () => {
    running = start({ getUrl: () => MEETING_URL });
    await running.ready;
    expect(panel()).toBeTruthy();

    chrome.emitChange(MEET_SETTINGS_KEY, { enabled: false, intervalMinutes: 15 });
    expect(panel()).toBeNull();
  });

  it('stays off the page the browser is actually on when it is not a meeting', async () => {
    running = start();
    await running.ready;

    expect(panel()).toBeNull();
  });

  it('exposes the running session so the countdown can be inspected', async () => {
    running = start({ getUrl: () => MEETING_URL });
    await running.ready;

    expect(running.getSession()?.controller.getSnapshot()).toMatchObject({
      state: 'waiting',
      joinAt: at(10, 15),
    });

    running.stop();
    expect(running.getSession()).toBeNull();
  });
});
