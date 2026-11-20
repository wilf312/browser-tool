import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createPathReplaceRule,
  loadPathReplaceRules,
  PATH_REPLACE_STORAGE_KEY,
  sanitizePathReplaceRules,
  savePathReplaceRules,
} from './path-replace-storage';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';

let chrome: FakeChrome;

beforeEach(() => {
  chrome = installFakeChrome();
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('createPathReplaceRule', () => {
  it('starts a new rule asking before it replaces anything', () => {
    const rule = createPathReplaceRule();
    expect(rule).toMatchObject({ pattern: '', from: '', to: '', mode: 'confirm' });
    expect(rule.id).toBeTruthy();
  });

  it('gives every rule its own id', () => {
    expect(createPathReplaceRule().id).not.toBe(createPathReplaceRule().id);
  });
});

describe('sanitizePathReplaceRules', () => {
  it('fills in what is missing and falls back to asking for an unknown mode', () => {
    const [rule] = sanitizePathReplaceRules([
      { id: 'a', pattern: 'example.com', mode: 'sometimes' },
    ]);
    expect(rule).toEqual({ id: 'a', pattern: 'example.com', from: '', to: '', mode: 'confirm' });
  });

  it('keeps every known mode', () => {
    const modes = sanitizePathReplaceRules([
      { mode: 'always' },
      { mode: 'confirm' },
      { mode: 'disabled' },
    ]).map((rule) => rule.mode);
    expect(modes).toEqual(['always', 'confirm', 'disabled']);
  });

  it('drops what is not a rule', () => {
    expect(sanitizePathReplaceRules([null, 1, 'x', [], { pattern: 'a.com' }])).toHaveLength(1);
    expect(sanitizePathReplaceRules('nope')).toEqual([]);
  });
});

describe('storage', () => {
  it('writes the rules under their own key and reads them back', async () => {
    const rule = { id: '1', pattern: 'example.com', from: 'a', to: 'b', mode: 'always' as const };
    await savePathReplaceRules([rule]);
    expect(chrome.store[PATH_REPLACE_STORAGE_KEY]).toEqual([rule]);
    expect(await loadPathReplaceRules()).toEqual([rule]);
  });

  it('reads nothing as no rules', async () => {
    expect(await loadPathReplaceRules()).toEqual([]);
  });
});
