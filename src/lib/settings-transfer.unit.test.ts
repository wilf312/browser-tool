import { describe, it, expect } from 'vitest';
import {
  buildBundle,
  describeFeature,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  exportFilename,
  FEATURE_IDS,
  FEATURE_LABELS,
  featuresInBundle,
  formatExportedAt,
  parseBundle,
  pickFeatures,
  sanitizeFeatures,
  serializeBundle,
  type SettingsFeatures,
} from './settings-transfer';

const rules = [
  { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
  { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: false },
];

const meet = { enabled: true, intervalMinutes: 30 };

const both: SettingsFeatures = { redirectRules: rules, meetAutoJoin: meet };

/** The text of a file holding both features. */
function exportedText(): string {
  return serializeBundle(buildBundle(both, FEATURE_IDS));
}

describe('the features that can be transferred', () => {
  it('has a label for every feature', () => {
    expect(FEATURE_IDS.map((id) => FEATURE_LABELS[id])).toEqual([
      'Jira ドメインリダイレクト',
      'Meet 自動入室',
    ]);
  });
});

describe('pickFeatures', () => {
  it('keeps only what was asked for', () => {
    expect(pickFeatures(both, ['meetAutoJoin'])).toEqual({ meetAutoJoin: meet });
  });

  it('leaves out a feature that is not there even when it is asked for', () => {
    expect(pickFeatures({ meetAutoJoin: meet }, FEATURE_IDS)).toEqual({ meetAutoJoin: meet });
  });

  it('returns nothing when nothing is picked', () => {
    expect(pickFeatures(both, [])).toEqual({});
  });
});

describe('featuresInBundle', () => {
  it('lists the features that are there, in display order', () => {
    expect(featuresInBundle(both)).toEqual(['redirectRules', 'meetAutoJoin']);
    expect(featuresInBundle({ meetAutoJoin: meet })).toEqual(['meetAutoJoin']);
    expect(featuresInBundle({})).toEqual([]);
  });
});

describe('buildBundle', () => {
  it('stamps the format, the version and the time', () => {
    const bundle = buildBundle(both, FEATURE_IDS, new Date('2026-08-04T12:10:00Z'));

    expect(bundle.format).toBe(EXPORT_FORMAT);
    expect(bundle.version).toBe(EXPORT_VERSION);
    expect(bundle.exportedAt).toBe('2026-08-04T12:10:00.000Z');
  });

  it('carries only the picked features', () => {
    const bundle = buildBundle(both, ['redirectRules']);
    expect(bundle.features).toEqual({ redirectRules: rules });
  });

  it('stamps the current time when none is given', () => {
    const before = Date.now();
    const bundle = buildBundle(both, FEATURE_IDS);
    expect(new Date(bundle.exportedAt).getTime()).toBeGreaterThanOrEqual(before);
  });
});

describe('serializeBundle', () => {
  it('writes indented JSON that ends with a newline', () => {
    const text = serializeBundle(buildBundle({ meetAutoJoin: meet }, FEATURE_IDS));

    expect(text.endsWith('\n')).toBe(true);
    expect(text).toContain('\n  "version": 1');
  });
});

describe('parseBundle', () => {
  it('reads back what was exported', () => {
    const result = parseBundle(exportedText());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.features).toEqual(both);
  });

  it('still reads a file written under the old browser-tool name', () => {
    const text = `{"format":"browser-tool-settings","version":1,"features":{"meetAutoJoin":{"enabled":true,"intervalMinutes":15}}}`;

    const result = parseBundle(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.format).toBe(EXPORT_FORMAT);
    expect(result.bundle.features.meetAutoJoin).toEqual({ enabled: true, intervalMinutes: 15 });
  });

  it('refuses text that is not JSON', () => {
    expect(parseBundle('{ nope')).toEqual({
      ok: false,
      error: 'JSON として読み取れませんでした',
    });
  });

  it.each([
    ['an array', '[]'],
    ['null', 'null'],
    ['another tool’s file', '{"format":"something-else","version":1,"features":{}}'],
    ['a missing version', `{"format":"${EXPORT_FORMAT}","features":{}}`],
    ['a version that is not a number', `{"format":"${EXPORT_FORMAT}","version":"1","features":{}}`],
    ['a version below 1', `{"format":"${EXPORT_FORMAT}","version":0,"features":{}}`],
  ])('refuses %s', (_label, text) => {
    expect(parseBundle(text)).toEqual({
      ok: false,
      error: 'Nanatsudougu の設定ファイルではありません',
    });
  });

  it('refuses a file written by a newer version instead of guessing', () => {
    const text = `{"format":"${EXPORT_FORMAT}","version":2,"features":{"meetAutoJoin":{}}}`;

    expect(parseBundle(text)).toEqual({
      ok: false,
      error: '新しい形式の設定ファイルです（version 2）。拡張機能を更新してください',
    });
  });

  it('refuses a file that holds no feature it knows', () => {
    const text = `{"format":"${EXPORT_FORMAT}","version":1,"features":{"somethingElse":{}}}`;

    expect(parseBundle(text)).toEqual({ ok: false, error: '取り込める設定が入っていません' });
  });

  it('keeps a file that holds only one feature', () => {
    const result = parseBundle(serializeBundle(buildBundle(both, ['redirectRules'])));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(featuresInBundle(result.bundle.features)).toEqual(['redirectRules']);
  });

  it('falls back to an empty timestamp when the file does not say', () => {
    const text = `{"format":"${EXPORT_FORMAT}","version":1,"features":{"meetAutoJoin":{}}}`;
    const result = parseBundle(text);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.bundle.exportedAt).toBe('');
  });
});

describe('sanitizeFeatures', () => {
  it('repairs hand edited settings', () => {
    const features = sanitizeFeatures({
      redirectRules: [{ from: 'a.atlassian.net' }, 'nope'],
      meetAutoJoin: { enabled: 'yes', intervalMinutes: 999 },
    });

    expect(features.redirectRules).toHaveLength(1);
    expect(features.redirectRules?.[0]).toMatchObject({
      from: 'a.atlassian.net',
      to: '',
      enabled: true,
    });
    expect(features.meetAutoJoin).toEqual({ enabled: true, intervalMinutes: 60 });
  });

  it.each([
    ['a non object', 'nope'],
    ['an array', []],
    ['null', null],
  ])('reads no feature out of %s', (_label, raw) => {
    expect(sanitizeFeatures(raw)).toEqual({});
  });

  it('drops features stored under the wrong shape', () => {
    expect(sanitizeFeatures({ redirectRules: {}, meetAutoJoin: [] })).toEqual({});
  });
});

describe('describeFeature', () => {
  it('counts the rules and the enabled ones', () => {
    expect(describeFeature(both, 'redirectRules')).toBe('ルール 2 件（有効 1 件）');
  });

  it('says so when there is no rule at all', () => {
    expect(describeFeature({ redirectRules: [] }, 'redirectRules')).toBe('ルールなし');
  });

  it('spells out the Meet settings', () => {
    expect(describeFeature(both, 'meetAutoJoin')).toBe('自動入室 ON / 30 分間隔');
    expect(
      describeFeature({ meetAutoJoin: { enabled: false, intervalMinutes: 15 } }, 'meetAutoJoin'),
    ).toBe('自動入室 OFF / 15 分間隔');
  });

  it('describes a missing feature as nothing', () => {
    expect(describeFeature({}, 'redirectRules')).toBe('');
    expect(describeFeature({}, 'meetAutoJoin')).toBe('');
  });
});

describe('formatExportedAt', () => {
  it('shows the local date and time', () => {
    const date = new Date(2026, 7, 4, 12, 10);
    expect(formatExportedAt(date.toISOString())).toBe('2026-08-04 12:10');
  });

  it('shows nothing for a timestamp it cannot read', () => {
    expect(formatExportedAt('')).toBe('');
    expect(formatExportedAt('yesterday')).toBe('');
  });
});

describe('exportFilename', () => {
  it('carries the local date and time so files sort by when they were made', () => {
    expect(exportFilename(new Date(2026, 7, 4, 9, 5))).toBe(
      'nanatsudougu-settings-20260804-0905.json',
    );
  });

  it('uses the current time when none is given', () => {
    expect(exportFilename()).toMatch(/^nanatsudougu-settings-\d{8}-\d{4}\.json$/);
  });
});
