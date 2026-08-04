import { describe, it, expect, beforeEach, vi } from 'vitest';
import { syncDynamicRules } from '../src/lib/dnr-sync.js';

function fakeChrome(existing = []) {
  return {
    declarativeNetRequest: {
      getDynamicRules: vi.fn(async () => existing),
      updateDynamicRules: vi.fn(async () => {}),
    },
  };
}

beforeEach(() => {
  delete globalThis.chrome;
});

describe('syncDynamicRules', () => {
  it('replaces the existing dynamic rules with the ones built from the stored rules', async () => {
    const chrome = fakeChrome([{ id: 7 }, { id: 9 }]);
    globalThis.chrome = chrome;

    await syncDynamicRules([{ id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledTimes(1);
    const arg = chrome.declarativeNetRequest.updateDynamicRules.mock.calls[0][0];
    expect(arg.removeRuleIds).toEqual([7, 9]);
    expect(arg.addRules).toHaveLength(1);
    expect(arg.addRules[0].action.redirect.transform.host).toBe('b.atlassian.net');
    expect(arg.addRules[0].condition.urlFilter).toBe('||a.atlassian.net/');
  });

  it('clears the dynamic rules when every rule is disabled', async () => {
    const chrome = fakeChrome([{ id: 1 }]);
    globalThis.chrome = chrome;

    await syncDynamicRules([{ id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false }]);

    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [1],
      addRules: [],
    });
  });

  it('handles an empty rule set', async () => {
    const chrome = fakeChrome();
    globalThis.chrome = chrome;

    await syncDynamicRules([]);

    expect(chrome.declarativeNetRequest.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: [],
    });
  });

  it('does nothing when the declarativeNetRequest api is missing', async () => {
    await expect(syncDynamicRules([])).resolves.toBeUndefined();
  });
});
