/**
 * The service worker has no exports: it wires itself up when it is imported.
 * Every test therefore re-imports it against a freshly installed fake chrome.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { STORAGE_KEY } from './lib/storage';
import { RELOAD_JOBS_KEY, reloadAlarmName } from './lib/reload-jobs';
import { COPY_TITLE_MENU_ID, COPY_URL_MENU_ID } from './lib/page-copy';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../tests/fake-chrome';

const RULES = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }];

/** A timer that started a minute ago and has an hour left to run. */
function runningJob() {
  const startedAt = Date.now() - 60_000;
  return { tabId: 7, intervalSeconds: 60, startedAt, endsAt: startedAt + 60 * 60_000 };
}

let chrome: FakeChrome;

/** Boot the worker and wait for the sync it kicks off on its own. */
async function boot(): Promise<void> {
  vi.resetModules();
  await import('./background');
  await vi.waitFor(() => expect(chrome.dnr.updateDynamicRules).toHaveBeenCalled());
}

/** Boot the worker next to the offscreen document, and record what reaches the clipboard. */
async function bootWithOffscreen(): Promise<string[]> {
  await boot();
  await import('./offscreen/main');
  const copied: string[] = [];
  document.execCommand = vi.fn(() => {
    copied.push(document.querySelector('textarea')?.value ?? '');
    return true;
  });
  return copied;
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

    // One for the redirect rules, one for the page copy menu.
    expect(chrome.runtime.installed).toHaveLength(2);
    expect(chrome.runtime.startup).toHaveLength(2);
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

describe('reload timers', () => {
  it('reloads the tab when its alarm fires', async () => {
    chrome = installFakeChrome({
      storage: { [STORAGE_KEY]: RULES },
      session: { [RELOAD_JOBS_KEY]: { 7: runningJob() } },
    });
    await boot();

    chrome.emitAlarm(reloadAlarmName(7));

    await vi.waitFor(() => expect(chrome.tabs.reload).toHaveBeenCalledWith(7));
  });

  it('leaves alarms that are not reload timers alone', async () => {
    await boot();

    chrome.emitAlarm('something-else');

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });

  it('stops the timer of a tab the user closed', async () => {
    chrome = installFakeChrome({
      storage: { [STORAGE_KEY]: RULES },
      session: { [RELOAD_JOBS_KEY]: { 7: runningJob() } },
    });
    await boot();

    chrome.emitTabRemoved(7);

    await vi.waitFor(() => expect(chrome.sessionStore[RELOAD_JOBS_KEY]).toEqual({}));
    expect(chrome.alarms.clear).toHaveBeenCalledWith(reloadAlarmName(7));
  });

  it('logs instead of throwing when the timer of a closed tab cannot be stopped', async () => {
    chrome = installFakeChrome({
      storage: { [STORAGE_KEY]: RULES },
      session: { [RELOAD_JOBS_KEY]: { 7: runningJob() } },
    });
    await boot();
    const error = new Error('alarms are unavailable');
    chrome.alarms.clear.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    chrome.emitTabRemoved(7);

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(logged.mock.calls[0]).toContain(error);
  });

  it('logs instead of throwing when a reload fails', async () => {
    chrome = installFakeChrome({
      storage: { [STORAGE_KEY]: RULES },
      session: { [RELOAD_JOBS_KEY]: { 7: runningJob() } },
    });
    await boot();
    const error = new Error('session storage is gone');
    chrome.session.get.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    chrome.emitAlarm(reloadAlarmName(7));

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(logged.mock.calls[0]).toContain(error);
  });
});

describe('page copy menu', () => {
  const TAB = { id: 7, title: 'XAPP-134 - Jira', url: 'https://b.atlassian.net/browse/XAPP-134' };

  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('adds the two items to every context menu when the extension is installed', async () => {
    await boot();

    chrome.emitRuntime('installed');

    await vi.waitFor(() => expect(chrome.contextMenus.create).toHaveBeenCalledTimes(2));
    expect(chrome.contextMenus.removeAll).toHaveBeenCalledBefore(chrome.contextMenus.create);
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: COPY_TITLE_MENU_ID,
      title: 'ページのタイトルをコピー',
      contexts: ['all'],
    });
    expect(chrome.contextMenus.create).toHaveBeenCalledWith({
      id: COPY_URL_MENU_ID,
      title: 'ページの URL をコピー',
      contexts: ['all'],
    });
  });

  it('builds the items again when the browser starts up', async () => {
    await boot();

    chrome.emitRuntime('startup');

    await vi.waitFor(() => expect(chrome.contextMenus.create).toHaveBeenCalledTimes(2));
    expect(chrome.contextMenus.removeAll).toHaveBeenCalledTimes(1);
  });

  it('logs instead of throwing when the items cannot be set up', async () => {
    await boot();
    const error = new Error('menus are unavailable');
    chrome.contextMenus.removeAll.mockRejectedValue(error);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    chrome.emitRuntime('installed');

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(logged.mock.calls[0]).toContain(error);
    expect(chrome.contextMenus.create).not.toHaveBeenCalled();
  });

  it('copies the title of the tab', async () => {
    const copied = await bootWithOffscreen();

    chrome.emitMenuClick({ menuItemId: COPY_TITLE_MENU_ID, pageUrl: TAB.url }, TAB);

    await vi.waitFor(() => expect(copied).toEqual(['XAPP-134 - Jira']));
    await vi.waitFor(() => expect(chrome.offscreenOpen).toBe(false));
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('copies the URL of the tab', async () => {
    const copied = await bootWithOffscreen();

    chrome.emitMenuClick({ menuItemId: COPY_URL_MENU_ID, pageUrl: TAB.url }, TAB);

    await vi.waitFor(() => expect(copied).toEqual([TAB.url]));
  });

  it('falls back to the URL of the page when the tab does not tell it', async () => {
    const copied = await bootWithOffscreen();

    chrome.emitMenuClick({ menuItemId: COPY_URL_MENU_ID, pageUrl: TAB.url }, { id: 7 });

    await vi.waitFor(() => expect(copied).toEqual([TAB.url]));
  });

  it('leaves the clipboard alone when the page has no title', async () => {
    await bootWithOffscreen();

    chrome.emitMenuClick({ menuItemId: COPY_TITLE_MENU_ID, pageUrl: TAB.url }, { id: 7 });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
  });

  it('logs instead of throwing when the copy fails', async () => {
    await bootWithOffscreen();
    document.execCommand = vi.fn(() => false);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    chrome.emitMenuClick({ menuItemId: COPY_URL_MENU_ID, pageUrl: TAB.url }, TAB);

    await vi.waitFor(() => expect(logged).toHaveBeenCalled());
    expect(String(logged.mock.calls[0][1])).toContain('could not copy');
  });
});
