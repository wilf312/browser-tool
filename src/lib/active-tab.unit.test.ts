import { describe, it, expect, afterEach } from 'vitest';
import { getActiveTab } from './active-tab';
import { installFakeChrome, uninstallFakeChrome } from '../../tests/fake-chrome';

afterEach(() => {
  uninstallFakeChrome();
});

describe('getActiveTab', () => {
  it('reports the tab the popup was opened over', async () => {
    installFakeChrome({ activeTab: { id: 7, url: 'https://example.com/board', title: 'Board' } });

    await expect(getActiveTab()).resolves.toEqual({
      id: 7,
      url: 'https://example.com/board',
      title: 'Board',
    });
  });

  it('falls back to empty strings when the URL was not granted', async () => {
    installFakeChrome({ activeTab: { id: 7 } });

    await expect(getActiveTab()).resolves.toEqual({ id: 7, url: '', title: '' });
  });

  it('has nothing to offer when the settings page is a tab of its own', async () => {
    // `chrome://extensions` → 「オプション」. There is no grant on anything then,
    // not even on the page that happens to be active in another window.
    installFakeChrome({
      activeTab: { id: 9, url: 'https://example.com/board' },
      currentTab: { id: 7, url: 'chrome-extension://abc/options.html' },
    });

    await expect(getActiveTab()).resolves.toBeNull();
  });

  it('is null when there is no usable tab', async () => {
    installFakeChrome({ activeTab: null });
    await expect(getActiveTab()).resolves.toBeNull();

    installFakeChrome({ activeTab: { id: -1 } });
    await expect(getActiveTab()).resolves.toBeNull();
  });

  it('is null outside the extension', async () => {
    await expect(getActiveTab()).resolves.toBeNull();
  });
});
