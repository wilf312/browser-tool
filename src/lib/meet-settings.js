/** Persistence for the Meet auto join settings, backed by `chrome.storage.sync`. */

import { readSync, writeSync, onSyncValueChanged } from './sync-storage.js';
import { DEFAULT_INTERVAL_MINUTES, normalizeIntervalMinutes } from './meet-schedule.js';

export const MEET_SETTINGS_KEY = 'meetAutoJoin';

/** Off by default: joining a meeting on the user's behalf has to be asked for. */
export const DEFAULT_MEET_SETTINGS = Object.freeze({
  enabled: false,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
});

/** Coerce anything read from storage into well formed settings. */
export function sanitizeMeetSettings(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_MEET_SETTINGS };
  }
  return {
    enabled: raw.enabled === undefined ? DEFAULT_MEET_SETTINGS.enabled : Boolean(raw.enabled),
    intervalMinutes: normalizeIntervalMinutes(
      raw.intervalMinutes === undefined ? DEFAULT_MEET_SETTINGS.intervalMinutes : raw.intervalMinutes,
    ),
  };
}

/** Read the settings. Resolves to the defaults when nothing is stored. */
export async function loadMeetSettings() {
  return sanitizeMeetSettings(await readSync(MEET_SETTINGS_KEY));
}

/** Persist the settings. */
export async function saveMeetSettings(settings) {
  await writeSync(MEET_SETTINGS_KEY, sanitizeMeetSettings(settings));
}

/** Subscribe to settings changes made in another context (popup, options, other device). */
export function onMeetSettingsChanged(callback) {
  onSyncValueChanged(MEET_SETTINGS_KEY, (newValue) => callback(sanitizeMeetSettings(newValue)));
}
