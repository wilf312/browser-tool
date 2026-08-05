/**
 * The service worker has no exports: it wires itself up when it is imported.
 * Every test therefore re-imports it against a freshly installed fake chrome.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEY } from './lib/storage';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../tests/fake-chrome';

const RULES = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }];

let chrome: FakeChrome;

/** Boot the worker and wait for the sync it kicks off on its own. */
async function boot(): Promise<void> {
  vi.resetModules();
  await import('./background');
  await vi.waitFor(() => expect(chrome.dnr.updateDynamicRules).toHaveBeenCalled());
}

function addedHosts(call: number): unknown[] {
  const [options] = chrome.dnr.updateDynamicRules.mock.calls[call];
  return (options.addRules as Array<{ action: { redirect: { transform: { host: string } } } }>).map(
    (rule) => rule.action.redirect.transform.host,
  );
}

beforeEach(() => {
  chrome = installFakeChrome({ storage: { [STORAGE_KEY]: RULES }, dynamicRules: [{ id: 3 }] });
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('background service worker', () => {
  it('mirrors the stored rules into the dynamic rules as soon as it wakes up', async () => {
    await boot();

    expect(chrome.sync.get).toHaveBeenCalledWith(STORAGE_KEY);
    const [options] = chrome.dnr.updateDynamicRules.mock.calls[0];
    expect(options.removeRuleIds).toEqual([3]);
    expect(addedHosts(0)).toEqual(['b.atlassian.net']);
  });

  it('registers for the install and the startup events', async () => {
    await boot();

    expect(chrome.runtime.installed).toHaveLength(1);
    expect(chrome.runtime.startup).toHaveLength(1);
  });

  it('re-syncs when the browser installs the extension', async () => {
    await boot();

    chrome.emitRuntime('installed');
    await vi.waitFor(() => expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledTimes(2));
  });

  it('re-syncs when the browser starts up', async () => {
    await boot();

    chrome.emitRuntime('startup');
    await vi.waitFor(() => expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledTimes(2));
  });

  it('re-syncs when the rules are edited in another context', async () => {
    await boot();

    chrome.emitChange(STORAGE_KEY, [
      { id: '9', from: 'x.atlassian.net', to: 'y.atlassian.net', enabled: true },
    ]);

    await vi.waitFor(() => expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledTimes(2));
    expect(addedHosts(1)).toEqual(['y.atlassian.net']);
  });

  it('ignores rule changes in another storage area', async () => {
    await boot();

    chrome.emitChange(STORAGE_KEY, [], 'local');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.dnr.updateDynamicRules).toHaveBeenCalledTimes(1);
  });

  it('logs instead of throwing when the initial sync fails', async () => {
    const error = new Error('no dynamic rules today');
    chrome.dnr.getDynamicRules.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.resetModules();
    await import('./background');

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(logged.mock.calls[0]).toContain(error);
  });

  it('logs instead of throwing when a sync triggered by an edit fails', async () => {
    await boot();
    const error = new Error('quota exceeded');
    chrome.dnr.updateDynamicRules.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    chrome.emitChange(STORAGE_KEY, RULES);

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(logged.mock.calls[0]).toContain(error);
  });
});
