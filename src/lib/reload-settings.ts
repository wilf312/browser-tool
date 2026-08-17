/** Persistence for the reload timer defaults, backed by `chrome.storage.sync`. */

import { readSync, writeSync, onSyncValueChanged } from './sync-storage';
import {
  DEFAULT_RELOAD_DURATION_MINUTES,
  DEFAULT_RELOAD_INTERVAL_SECONDS,
  normalizeDurationMinutes,
  normalizeIntervalSeconds,
} from './reload-timer';
import type { ReloadSettings } from './types';

export const RELOAD_SETTINGS_KEY = 'reloadTimer';

/** What the dropdowns show before anything has been picked. */
export const DEFAULT_RELOAD_SETTINGS: Readonly<ReloadSettings> = Object.freeze({
  intervalSeconds: DEFAULT_RELOAD_INTERVAL_SECONDS,
  durationMinutes: DEFAULT_RELOAD_DURATION_MINUTES,
});

/** Coerce anything read from storage into well formed settings. */
export function sanitizeReloadSettings(raw: unknown): ReloadSettings {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_RELOAD_SETTINGS };
  }
  const settings = raw as Partial<ReloadSettings>;
  return {
    intervalSeconds: normalizeIntervalSeconds(settings.intervalSeconds),
    durationMinutes: normalizeDurationMinutes(settings.durationMinutes),
  };
}

/** Read the settings. Resolves to the defaults when nothing is stored. */
export async function loadReloadSettings(): Promise<ReloadSettings> {
  return sanitizeReloadSettings(await readSync(RELOAD_SETTINGS_KEY));
}

/** Persist the settings. */
export async function saveReloadSettings(settings: ReloadSettings): Promise<void> {
  await writeSync(RELOAD_SETTINGS_KEY, sanitizeReloadSettings(settings));
}

/** Subscribe to settings changes made in another context (popup, options, other device). */
export function onReloadSettingsChanged(callback: (settings: ReloadSettings) => void): void {
  onSyncValueChanged(RELOAD_SETTINGS_KEY, (newValue) => callback(sanitizeReloadSettings(newValue)));
}
