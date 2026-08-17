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
    expect(sanitizeReloadSettings({ intervalSeconds: 1800, durationMinutes: 480 })).toEqual({
      intervalSeconds: 1800,
      durationMinutes: 480,
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
      storage: { [RELOAD_SETTINGS_KEY]: { intervalSeconds: 600, durationMinutes: 240 } },
    });

    await expect(loadReloadSettings()).resolves.toEqual({
      intervalSeconds: 600,
      durationMinutes: 240,
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

    await saveReloadSettings({ intervalSeconds: 5, durationMinutes: 180 });

    expect(chrome.store[RELOAD_SETTINGS_KEY]).toEqual({
      intervalSeconds: DEFAULT_RELOAD_SETTINGS.intervalSeconds,
      durationMinutes: 180,
    });
  });
});

describe('onReloadSettingsChanged', () => {
  it('reports a change made in another context', () => {
    const chrome = installFakeChrome();
    const seen = vi.fn();

    onReloadSettingsChanged(seen);
    chrome.emitChange(RELOAD_SETTINGS_KEY, { intervalSeconds: 1800, durationMinutes: 180 });

    expect(seen).toHaveBeenCalledWith({ intervalSeconds: 1800, durationMinutes: 180 });
  });
});
