import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  DEFAULT_RELOAD_SETTINGS,
  loadReloadSettings,
  onReloadSettingsChanged,
  RELOAD_SETTINGS_KEY,
  sanitizeReloadSettings,
  saveReloadSettings,
} from './reload-settings';
import { installFakeChrome, uninstallFakeChrome } from '../../tests/fake-chrome';

afterEach(() => {
  uninstallFakeChrome();
});

describe('sanitizeReloadSettings', () => {
  it('keeps well formed settings', () => {
    expect(sanitizeReloadSettings({ intervalSeconds: 300, durationMinutes: 60 })).toEqual({
      intervalSeconds: 300,
      durationMinutes: 60,
    });
  });

  it('falls back to the defaults for anything unusable', () => {
    for (const value of [undefined, null, 'abc', [], {}, { intervalSeconds: 0 }]) {
      expect(sanitizeReloadSettings(value)).toEqual(DEFAULT_RELOAD_SETTINGS);
    }
  });
});

describe('loadReloadSettings', () => {
  it('reads the stored settings', async () => {
    installFakeChrome({
      storage: { [RELOAD_SETTINGS_KEY]: { intervalSeconds: 30, durationMinutes: 15 } },
    });

    await expect(loadReloadSettings()).resolves.toEqual({
      intervalSeconds: 30,
      durationMinutes: 15,
    });
  });

  it('falls back to the defaults when nothing is stored', async () => {
    installFakeChrome();

    await expect(loadReloadSettings()).resolves.toEqual(DEFAULT_RELOAD_SETTINGS);
  });
});

describe('saveReloadSettings', () => {
  it('writes the normalized settings', async () => {
    const chrome = installFakeChrome();

    await saveReloadSettings({ intervalSeconds: 5, durationMinutes: 60 });

    expect(chrome.store[RELOAD_SETTINGS_KEY]).toEqual({
      intervalSeconds: DEFAULT_RELOAD_SETTINGS.intervalSeconds,
      durationMinutes: 60,
    });
  });
});

describe('onReloadSettingsChanged', () => {
  it('reports a change made in another context', () => {
    const chrome = installFakeChrome();
    const seen = vi.fn();

    onReloadSettingsChanged(seen);
    chrome.emitChange(RELOAD_SETTINGS_KEY, { intervalSeconds: 600, durationMinutes: 180 });

    expect(seen).toHaveBeenCalledWith({ intervalSeconds: 600, durationMinutes: 180 });
  });
});
