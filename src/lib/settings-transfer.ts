/**
 * The file format used to carry the settings between browsers.
 *
 * Everything here is pure. Which features leave storage, and which ones from a
 * file are written back, is decided by the UI — this module only knows how a
 * bundle is shaped, how to read one back, and how to describe it to the user.
 */

import { t } from './i18n';
import { sanitizeMeetSettings } from './meet-settings';
import { sanitizeReloadSettings } from './reload-settings';
import { formatDurationLabel, formatIntervalLabel } from './reload-timer';
import { sanitizeRules } from './storage';
import type { MeetSettings, RedirectRule, ReloadSettings } from './types';

/** Stamped into the file so an unrelated JSON is rejected instead of half applied. */
export const EXPORT_FORMAT = 'nanatsudougu-settings';
export const EXPORT_VERSION = 1;

/** Written by the versions named `browser-tool`. Still read back, never written. */
const LEGACY_EXPORT_FORMATS = new Set<string>(['browser-tool-settings']);

/** The features that can be exported and imported on their own. */
export const FEATURE_IDS = ['redirectRules', 'meetAutoJoin', 'reloadTimer'] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const FEATURE_LABELS: Readonly<Record<FeatureId, string>> = Object.freeze({
  redirectRules: t('feature_redirect_rules'),
  meetAutoJoin: t('feature_meet_auto_join'),
  reloadTimer: t('feature_reload_timer'),
});

/** The settings of each feature. A bundle carries only the ones that were picked. */
export interface SettingsFeatures {
  redirectRules?: RedirectRule[];
  meetAutoJoin?: MeetSettings;
  /** The values a timer starts with. The running timers themselves are not carried. */
  reloadTimer?: ReloadSettings;
}

/** What a settings file contains. */
export interface SettingsBundle {
  format: typeof EXPORT_FORMAT;
  version: number;
  exportedAt: string;
  features: SettingsFeatures;
}

export type ParseResult = { ok: true; bundle: SettingsBundle } | { ok: false; error: string };

/** Keep only the features that were asked for; the rest stay out. */
export function pickFeatures(
  features: SettingsFeatures,
  ids: readonly FeatureId[],
): SettingsFeatures {
  const picked: SettingsFeatures = {};
  if (ids.includes('redirectRules') && features.redirectRules !== undefined) {
    picked.redirectRules = features.redirectRules;
  }
  if (ids.includes('meetAutoJoin') && features.meetAutoJoin !== undefined) {
    picked.meetAutoJoin = features.meetAutoJoin;
  }
  if (ids.includes('reloadTimer') && features.reloadTimer !== undefined) {
    picked.reloadTimer = features.reloadTimer;
  }
  return picked;
}

/** Which features a bundle actually carries, in the order they are shown. */
export function featuresInBundle(features: SettingsFeatures): FeatureId[] {
  return FEATURE_IDS.filter((id) => features[id] !== undefined);
}

/** Wrap the picked settings into the bundle that gets written to the file. */
export function buildBundle(
  features: SettingsFeatures,
  ids: readonly FeatureId[],
  now: Date = new Date(),
): SettingsBundle {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    features: pickFeatures(features, ids),
  };
}

/** The bundle as the text of the downloaded file — indented, so it stays readable. */
export function serializeBundle(bundle: SettingsBundle): string {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/** Coerce the features of a hand edited (or older) file into well formed settings. */
export function sanitizeFeatures(raw: unknown): SettingsFeatures {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const features = raw as Record<string, unknown>;
  const result: SettingsFeatures = {};
  if (Array.isArray(features.redirectRules)) {
    result.redirectRules = sanitizeRules(features.redirectRules);
  }
  const meet = features.meetAutoJoin;
  if (meet !== null && typeof meet === 'object' && !Array.isArray(meet)) {
    result.meetAutoJoin = sanitizeMeetSettings(meet);
  }
  const reload = features.reloadTimer;
  if (reload !== null && typeof reload === 'object' && !Array.isArray(reload)) {
    result.reloadTimer = sanitizeReloadSettings(reload);
  }
  return result;
}

/** Read a file back. Anything that is not one of ours is refused with a reason. */
export function parseBundle(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: t('transfer_error_json') };
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: t('transfer_error_not_ours') };
  }

  const candidate = raw as Partial<SettingsBundle>;
  const format: unknown = candidate.format;
  const version = candidate.version;
  const known =
    typeof format === 'string' && (format === EXPORT_FORMAT || LEGACY_EXPORT_FORMATS.has(format));
  if (!known || typeof version !== 'number' || !(version >= 1)) {
    return { ok: false, error: t('transfer_error_not_ours') };
  }
  if (version > EXPORT_VERSION) {
    return {
      ok: false,
      error: t('transfer_error_newer', [String(version)]),
    };
  }

  const features = sanitizeFeatures(candidate.features);
  if (featuresInBundle(features).length === 0) {
    return { ok: false, error: t('transfer_error_empty') };
  }

  return {
    ok: true,
    bundle: {
      format: EXPORT_FORMAT,
      version,
      exportedAt: typeof candidate.exportedAt === 'string' ? candidate.exportedAt : '',
      features,
    },
  };
}

/** One line about what a feature holds — shown next to its checkbox. */
export function describeFeature(features: SettingsFeatures, id: FeatureId): string {
  if (id === 'redirectRules') {
    const rules = features.redirectRules;
    if (rules === undefined) return '';
    if (rules.length === 0) return t('describe_no_rules');
    const enabled = rules.filter((rule) => rule.enabled).length;
    return t('describe_rules', [String(rules.length), String(enabled)]);
  }
  if (id === 'meetAutoJoin') {
    const settings = features.meetAutoJoin;
    if (settings === undefined) return '';
    return t('describe_meet', [settings.enabled ? 'ON' : 'OFF', String(settings.intervalMinutes)]);
  }
  const timer = features.reloadTimer;
  if (timer === undefined) return '';
  return t('describe_reload', [
    formatIntervalLabel(timer.intervalSeconds),
    formatDurationLabel(timer.durationMinutes),
  ]);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-08-04 12:10` — when the file was written, or `''` if it does not say. */
export function formatExportedAt(exportedAt: string): string {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** `nanatsudougu-settings-20260804-1210.json` */
export function exportFilename(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `nanatsudougu-settings-${stamp}.json`;
}
