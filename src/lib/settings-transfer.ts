/**
 * The file format used to carry the settings between browsers.
 *
 * Everything here is pure. Which features leave storage, and which ones from a
 * file are written back, is decided by the UI — this module only knows how a
 * bundle is shaped, how to read one back, and how to describe it to the user.
 */

import { sanitizeMeetSettings } from './meet-settings';
import { sanitizeRules } from './storage';
import type { MeetSettings, RedirectRule } from './types';

/** Stamped into the file so an unrelated JSON is rejected instead of half applied. */
export const EXPORT_FORMAT = 'browser-tool-settings';
export const EXPORT_VERSION = 1;

/** The features that can be exported and imported on their own. */
export const FEATURE_IDS = ['redirectRules', 'meetAutoJoin'] as const;

export type FeatureId = (typeof FEATURE_IDS)[number];

export const FEATURE_LABELS: Readonly<Record<FeatureId, string>> = Object.freeze({
  redirectRules: 'Jira ドメインリダイレクト',
  meetAutoJoin: 'Meet 自動入室',
});

/** The settings of each feature. A bundle carries only the ones that were picked. */
export interface SettingsFeatures {
  redirectRules?: RedirectRule[];
  meetAutoJoin?: MeetSettings;
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
  return result;
}

/** Read a file back. Anything that is not one of ours is refused with a reason. */
export function parseBundle(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'JSON として読み取れませんでした' };
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'browser-tool の設定ファイルではありません' };
  }

  const candidate = raw as Partial<SettingsBundle>;
  const version = candidate.version;
  if (candidate.format !== EXPORT_FORMAT || typeof version !== 'number' || !(version >= 1)) {
    return { ok: false, error: 'browser-tool の設定ファイルではありません' };
  }
  if (version > EXPORT_VERSION) {
    return {
      ok: false,
      error: `新しい形式の設定ファイルです（version ${version}）。拡張機能を更新してください`,
    };
  }

  const features = sanitizeFeatures(candidate.features);
  if (featuresInBundle(features).length === 0) {
    return { ok: false, error: '取り込める設定が入っていません' };
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
    if (rules.length === 0) return 'ルールなし';
    const enabled = rules.filter((rule) => rule.enabled).length;
    return `ルール ${rules.length} 件（有効 ${enabled} 件）`;
  }
  const settings = features.meetAutoJoin;
  if (settings === undefined) return '';
  return `自動入室 ${settings.enabled ? 'ON' : 'OFF'} / ${settings.intervalMinutes} 分間隔`;
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

/** `browser-tool-settings-20260804-1210.json` */
export function exportFilename(now: Date = new Date()): string {
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `browser-tool-settings-${stamp}.json`;
}
