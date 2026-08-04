import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_MEET_SETTINGS,
  MEET_SETTINGS_KEY,
  loadMeetSettings,
  onMeetSettingsChanged,
  sanitizeMeetSettings,
  saveMeetSettings,
} from '../src/lib/meet-settings.js';

function fakeChrome(initial = {}) {
  const store = { ...initial };
  const listeners = [];
  return {
    store,
    listeners,
    storage: {
      sync: {
        get: vi.fn(async (key) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items) => Object.assign(store, items)),
      },
      onChanged: {
        addListener: vi.fn((cb) => listeners.push(cb)),
      },
    },
  };
}

beforeEach(() => {
  delete globalThis.chrome;
});

describe('sanitizeMeetSettings', () => {
  it('keeps well formed settings', () => {
    expect(sanitizeMeetSettings({ enabled: true, intervalMinutes: 30 })).toEqual({
      enabled: true,
      intervalMinutes: 30,
    });
  });

  it('is off by default', () => {
    expect(DEFAULT_MEET_SETTINGS.enabled).toBe(false);
    expect(sanitizeMeetSettings(undefined)).toEqual({ ...DEFAULT_MEET_SETTINGS });
  });

  it('coerces junk to safe values', () => {
    expect(sanitizeMeetSettings({ enabled: 'yes', intervalMinutes: 'abc' })).toEqual({
      enabled: true,
      intervalMinutes: 15,
    });
    expect(sanitizeMeetSettings([])).toEqual({ ...DEFAULT_MEET_SETTINGS });
    expect(sanitizeMeetSettings(null)).toEqual({ ...DEFAULT_MEET_SETTINGS });
  });
});

describe('loadMeetSettings', () => {
  it('reads the sanitized settings from chrome.storage.sync', async () => {
    const chrome = fakeChrome({ [MEET_SETTINGS_KEY]: { enabled: true, intervalMinutes: 5 } });
    globalThis.chrome = chrome;
    await expect(loadMeetSettings()).resolves.toEqual({ enabled: true, intervalMinutes: 5 });
    expect(chrome.storage.sync.get).toHaveBeenCalledWith(MEET_SETTINGS_KEY);
  });

  it('returns the defaults when nothing is stored', async () => {
    globalThis.chrome = fakeChrome();
    await expect(loadMeetSettings()).resolves.toEqual({ ...DEFAULT_MEET_SETTINGS });
  });

  it('returns the defaults when the extension apis are missing', async () => {
    await expect(loadMeetSettings()).resolves.toEqual({ ...DEFAULT_MEET_SETTINGS });
  });
});

describe('saveMeetSettings', () => {
  it('writes the sanitized settings', async () => {
    const chrome = fakeChrome();
    globalThis.chrome = chrome;
    await saveMeetSettings({ enabled: 1, intervalMinutes: '30' });
    expect(chrome.store[MEET_SETTINGS_KEY]).toEqual({ enabled: true, intervalMinutes: 30 });
  });

  it('does nothing when the extension apis are missing', async () => {
    await expect(saveMeetSettings({ enabled: true })).resolves.toBeUndefined();
  });
});

describe('onMeetSettingsChanged', () => {
  it('calls back with the new settings', () => {
    const chrome = fakeChrome();
    globalThis.chrome = chrome;
    const cb = vi.fn();
    onMeetSettingsChanged(cb);

    chrome.listeners[0]({ [MEET_SETTINGS_KEY]: { newValue: { enabled: true, intervalMinutes: 30 } } }, 'sync');
    expect(cb).toHaveBeenCalledWith({ enabled: true, intervalMinutes: 30 });
  });

  it('ignores other areas and other keys', () => {
    const chrome = fakeChrome();
    globalThis.chrome = chrome;
    const cb = vi.fn();
    onMeetSettingsChanged(cb);

    chrome.listeners[0]({ [MEET_SETTINGS_KEY]: { newValue: {} } }, 'local');
    chrome.listeners[0]({ somethingElse: { newValue: {} } }, 'sync');
    expect(cb).not.toHaveBeenCalled();
  });
});
