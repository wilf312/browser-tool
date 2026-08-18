/**
 * The tab the settings page acts on.
 *
 * The reload timer needs a tab to point at, and the only one it can mean is the
 * one that was on screen when the toolbar icon was clicked. Reading its URL is
 * what `activeTab` is for: clicking the icon grants it for that tab and nothing
 * else, so the extension never gets to see the rest of the browsing.
 *
 * That grant is what makes the popup the only place this works. Opened from
 * `chrome://extensions` instead, the settings page is a tab of its own with no
 * grant on anything, so there is no tab to offer and this reports none.
 */

export interface ActiveTab {
  id: number;
  /** `''` when the extension was not granted a look at the tab's URL. */
  url: string;
  title: string;
}

/** The tab under the popup, or `null` when there is none to act on. */
export async function getActiveTab(): Promise<ActiveTab | null> {
  const tabs = globalThis.chrome?.tabs;
  if (!tabs) return null;

  // `getCurrent` answers with a tab only when the page is one, which the popup
  // is not. A settings page that has its own tab is not looking at anything.
  if (await tabs.getCurrent?.()) return null;

  const [tab] = await tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined || tab.id < 0) return null;

  return { id: tab.id, url: tab.url ?? '', title: tab.title ?? '' };
}
