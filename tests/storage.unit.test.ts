import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  STORAGE_KEY,
  createRule,
  sanitizeRules,
  loadRules,
  saveRules,
  onRulesChanged,
} from '../src/lib/storage';
import type { RedirectRule } from '../src/lib/types';
import { installFakeChrome, uninstallFakeChrome } from './fake-chrome';

beforeEach(() => {
  uninstallFakeChrome();
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('createRule', () => {
  it('creates an enabled rule with a unique id', () => {
    const a = createRule({ from: 'a.atlassian.net', to: 'b.atlassian.net' });
    const b = createRule({ from: 'c.atlassian.net', to: 'd.atlassian.net' });
    expect(a).toMatchObject({ from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true });
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('defaults to empty hosts and lets enabled be overridden', () => {
    expect(createRule()).toMatchObject({ from: '', to: '', enabled: true });
    expect(createRule({ enabled: false }).enabled).toBe(false);
  });
});

describe('sanitizeRules', () => {
  it('keeps well formed rules as they are', () => {
    const rules = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false }];
    expect(sanitizeRules(rules)).toEqual(rules);
  });

  it('drops entries that are not objects', () => {
    expect(sanitizeRules(['x', null, 3, undefined])).toEqual([]);
  });

  it('coerces missing fields to safe defaults', () => {
    const [rule] = sanitizeRules([{ from: 'a.atlassian.net' }]);
    expect(rule).toMatchObject({ from: 'a.atlassian.net', to: '', enabled: true });
    expect(typeof rule.id).toBe('string');
    expect(rule.id).not.toBe('');
  });

  it('coerces enabled to a boolean', () => {
    expect(sanitizeRules([{ enabled: 0 }, { enabled: 'yes' }]).map((r) => r.enabled)).toEqual([
      false,
      true,
    ]);
  });

  it('returns an empty array for anything that is not an array', () => {
    expect(sanitizeRules(undefined)).toEqual([]);
    expect(sanitizeRules(null)).toEqual([]);
    expect(sanitizeRules({})).toEqual([]);
  });
});

describe('loadRules', () => {
  it('reads the sanitized rules from chrome.storage.sync', async () => {
    const chrome = installFakeChrome({
      storage: {
        [STORAGE_KEY]: [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }],
      },
    });
    await expect(loadRules()).resolves.toEqual([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
    ]);
    expect(chrome.sync.get).toHaveBeenCalledWith(STORAGE_KEY);
  });

  it('returns an empty array when nothing is stored', async () => {
    installFakeChrome();
    await expect(loadRules()).resolves.toEqual([]);
  });

  it('returns an empty array when the extension apis are missing', async () => {
    await expect(loadRules()).resolves.toEqual([]);
  });
});

describe('saveRules', () => {
  it('writes the sanitized rules to chrome.storage.sync', async () => {
    const chrome = installFakeChrome();
    await saveRules([
      { from: 'a.atlassian.net', to: 'b.atlassian.net' },
      'junk',
    ] as unknown as RedirectRule[]);
    const saved = chrome.store[STORAGE_KEY] as RedirectRule[];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      from: 'a.atlassian.net',
      to: 'b.atlassian.net',
      enabled: true,
    });
  });

  it('does nothing when the extension apis are missing', async () => {
    await expect(saveRules([])).resolves.toBeUndefined();
  });
});

describe('onRulesChanged', () => {
  it('calls back with the new rules when the sync area changes', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();
    onRulesChanged(cb);

    chrome.emitChange(STORAGE_KEY, [{ id: '1', from: 'a.b', to: 'c.d', enabled: true }]);
    expect(cb).toHaveBeenCalledWith([{ id: '1', from: 'a.b', to: 'c.d', enabled: true }]);
  });

  it('ignores changes to other areas and other keys', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();
    onRulesChanged(cb);

    chrome.emitChange(STORAGE_KEY, [], 'local');
    chrome.emitChange('somethingElse', []);
    expect(cb).not.toHaveBeenCalled();
  });
});
