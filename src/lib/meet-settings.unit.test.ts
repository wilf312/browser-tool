import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_MEET_SETTINGS,
  MEET_SETTINGS_KEY,
  loadMeetSettings,
  onMeetSettingsChanged,
  sanitizeMeetSettings,
  saveMeetSettings,
} from './meet-settings';
import type { MeetSettings } from './types';
import { installFakeChrome, uninstallFakeChrome } from '../../tests/fake-chrome';

beforeEach(() => {
  uninstallFakeChrome();
});

afterEach(() => {
  uninstallFakeChrome();
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

  it('fills in the fields that are not stored yet', () => {
    expect(sanitizeMeetSettings({ intervalMinutes: 30 })).toEqual({
      enabled: false,
      intervalMinutes: 30,
    });
    expect(sanitizeMeetSettings({ enabled: true })).toEqual({ enabled: true, intervalMinutes: 15 });
    expect(sanitizeMeetSettings({})).toEqual({ ...DEFAULT_MEET_SETTINGS });
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
    const chrome = installFakeChrome({
      storage: { [MEET_SETTINGS_KEY]: { enabled: true, intervalMinutes: 5 } },
    });
    await expect(loadMeetSettings()).resolves.toEqual({ enabled: true, intervalMinutes: 5 });
    expect(chrome.sync.get).toHaveBeenCalledWith(MEET_SETTINGS_KEY);
  });

  it('returns the defaults when nothing is stored', async () => {
    installFakeChrome();
    await expect(loadMeetSettings()).resolves.toEqual({ ...DEFAULT_MEET_SETTINGS });
  });

  it('returns the defaults when the extension apis are missing', async () => {
    await expect(loadMeetSettings()).resolves.toEqual({ ...DEFAULT_MEET_SETTINGS });
  });
});

describe('saveMeetSettings', () => {
  it('writes the sanitized settings', async () => {
    const chrome = installFakeChrome();
    await saveMeetSettings({ enabled: 1, intervalMinutes: '30' } as unknown as MeetSettings);
    expect(chrome.store[MEET_SETTINGS_KEY]).toEqual({ enabled: true, intervalMinutes: 30 });
  });

  it('does nothing when the extension apis are missing', async () => {
    await expect(saveMeetSettings({ enabled: true } as MeetSettings)).resolves.toBeUndefined();
  });
});

describe('onMeetSettingsChanged', () => {
  it('calls back with the new settings', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();
    onMeetSettingsChanged(cb);

    chrome.emitChange(MEET_SETTINGS_KEY, { enabled: true, intervalMinutes: 30 });
    expect(cb).toHaveBeenCalledWith({ enabled: true, intervalMinutes: 30 });
  });

  it('ignores other areas and other keys', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();
    onMeetSettingsChanged(cb);

    chrome.emitChange(MEET_SETTINGS_KEY, {}, 'local');
    chrome.emitChange('somethingElse', {});
    expect(cb).not.toHaveBeenCalled();
  });
});
