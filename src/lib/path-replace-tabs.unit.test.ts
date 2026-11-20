import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetTab, handleTabUpdated, replaceInPage } from './path-replace-tabs';
import { PATH_REPLACE_STORAGE_KEY } from './path-replace-storage';
import type { PathReplaceRule } from './types';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';

const SOURCE = 'https://example.com/docs/old/a?q=1';
const TARGET = 'https://example.com/docs/new/a?q=1';

function rule(patch: Partial<PathReplaceRule> = {}): PathReplaceRule {
  return {
    id: '1',
    pattern: 'example.com/docs/*',
    from: 'old',
    to: 'new',
    mode: 'confirm',
    ...patch,
  };
}

let chrome: FakeChrome;
let tabId = 100;

function install(rules: PathReplaceRule[]) {
  chrome = installFakeChrome({ storage: { [PATH_REPLACE_STORAGE_KEY]: rules } });
}

/** A tab this test has not seen yet, so the repeat guard of an earlier test does not apply. */
function freshTab(): number {
  tabId += 1;
  return tabId;
}

afterEach(() => {
  uninstallFakeChrome();
});

describe('handleTabUpdated', () => {
  beforeEach(() => install([rule()]));

  it('asks on the page before moving, by default', async () => {
    const id = freshTab();
    await handleTabUpdated(id, { status: 'loading', url: SOURCE }, { url: SOURCE });

    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
    const [injection] = chrome.scripting.executeScript.mock.calls[0];
    expect(injection.target).toEqual({ tabId: id });
    expect(injection.func).toBe(replaceInPage);
    expect(injection.args).toEqual([
      SOURCE,
      TARGET,
      `パスを置き換えて次のページに移動しますか？\n${TARGET}`,
    ]);
  });

  it('moves without asking when the rule says always', async () => {
    install([rule({ mode: 'always' })]);
    await handleTabUpdated(freshTab(), { url: SOURCE }, { url: SOURCE });

    const [injection] = chrome.scripting.executeScript.mock.calls[0];
    expect(injection.args).toEqual([SOURCE, TARGET, null]);
  });

  it('does nothing for a disabled rule', async () => {
    install([rule({ mode: 'disabled' })]);
    await handleTabUpdated(freshTab(), { url: SOURCE }, { url: SOURCE });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('does nothing on a page no rule matches', async () => {
    await handleTabUpdated(freshTab(), { url: 'https://example.com/other/old' }, {});
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('reacts to the same page being loaded again', async () => {
    await handleTabUpdated(freshTab(), { status: 'loading' }, { url: SOURCE });
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);
  });

  it('ignores the updates that are not navigations', async () => {
    const id = freshTab();
    await handleTabUpdated(id, { status: 'complete' }, { url: SOURCE });
    await handleTabUpdated(id, {}, { url: SOURCE });
    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
  });

  it('asks once when Chrome reports the same navigation twice', async () => {
    const id = freshTab();
    await handleTabUpdated(id, { status: 'loading', url: SOURCE }, { url: SOURCE }, 1000);
    await handleTabUpdated(id, { url: SOURCE }, { url: SOURCE }, 1200);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(1);

    // Coming back to it later is a new visit.
    await handleTabUpdated(id, { status: 'loading' }, { url: SOURCE }, 5000);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });

  it('forgets a closed tab', async () => {
    const id = freshTab();
    await handleTabUpdated(id, { url: SOURCE }, {}, 1000);
    forgetTab(id);
    await handleTabUpdated(id, { url: SOURCE }, {}, 1100);
    expect(chrome.scripting.executeScript).toHaveBeenCalledTimes(2);
  });
});

describe('replaceInPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does nothing once the page has moved on', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    replaceInPage('https://elsewhere.example/', 'https://example.com/new', 'go?');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('stays when the user declines', () => {
    const before = location.href;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    replaceInPage(location.href, 'https://example.com/new', 'go?');
    expect(confirm).toHaveBeenCalledWith('go?');
    expect(location.href).toBe(before);
  });
});
