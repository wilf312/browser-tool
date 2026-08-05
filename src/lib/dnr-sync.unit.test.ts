import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { syncDynamicRules } from './dnr-sync';
import { installFakeChrome, uninstallFakeChrome } from '../../tests/fake-chrome';

beforeEach(() => {
  uninstallFakeChrome();
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('syncDynamicRules', () => {
  it('replaces the existing dynamic rules with the ones built from the stored rules', async () => {
    const chrome = installFakeChrome({ dynamicRules: [{ id: 7 }, { id: 9 }] });

    await syncDynamicRules([
      { id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
    ]);

    expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledTimes(1);
    const [arg] = chrome.dnr.updateDynamicRules.mock.calls[0];
    expect(arg.removeRuleIds).toEqual([7, 9]);
    expect(arg.addRules).toHaveLength(1);
    expect(arg.addRules[0]).toMatchObject({
      action: { redirect: { transform: { host: 'b.atlassian.net' } } },
      condition: { urlFilter: '||a.atlassian.net/' },
    });
  });

  it('clears the dynamic rules when every rule is disabled', async () => {
    const chrome = installFakeChrome({ dynamicRules: [{ id: 1 }] });

    await syncDynamicRules([
      { id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false },
    ]);

    expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [1],
      addRules: [],
    });
  });

  it('handles an empty rule set', async () => {
    const chrome = installFakeChrome();

    await syncDynamicRules([]);

    expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledWith({
      removeRuleIds: [],
      addRules: [],
    });
  });

  it('copes with a browser that reports no dynamic rules at all', async () => {
    const chrome = installFakeChrome();
    chrome.dnr.getDynamicRules.mockResolvedValue(undefined);

    await syncDynamicRules([
      { id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
    ]);

    const [options] = chrome.dnr.updateDynamicRules.mock.calls[0];
    expect(options.removeRuleIds).toEqual([]);
    expect(options.addRules).toHaveLength(1);
  });

  it('does nothing when the declarativeNetRequest api is missing', async () => {
    await expect(syncDynamicRules([])).resolves.toBeUndefined();
  });
});
