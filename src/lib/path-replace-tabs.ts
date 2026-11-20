/**
 * Runs the path replace rules against the tabs the service worker hears about.
 *
 * The worker sees a tab's URL only on the hosts the user granted, which are the
 * hosts the rules name. When one matches, a small function is injected into
 * the page: it asks first when the rule says so, then calls `location.replace`.
 */

import { t } from './i18n';
import { resolvePathReplace } from './path-replace';
import { loadPathReplaceRules } from './path-replace-storage';

/** Chrome can report one navigation more than once; only the first one counts. */
const REPEAT_WINDOW_MS = 1000;

const lastSeen = new Map<number, { url: string; at: number }>();

/**
 * Injected into the page, so it must not reach anything outside itself.
 * The page is checked again: by the time it is idle it may have moved on.
 */
export function replaceInPage(
  sourceUrl: string,
  targetUrl: string,
  confirmMessage: string | null,
): void {
  if (location.href !== sourceUrl) return;
  if (confirmMessage !== null && !window.confirm(confirmMessage)) return;
  location.replace(targetUrl);
}

/** The slice of `tabs.onUpdated` this module reads. */
export interface TabChange {
  url?: string;
  status?: string;
}

/** Handle one `tabs.onUpdated` event. */
export async function handleTabUpdated(
  tabId: number,
  change: TabChange,
  tab: { url?: string },
  now: number = Date.now(),
): Promise<void> {
  // A new URL (a navigation, or a single page app's pushState), or the same one loading again.
  if (change.url === undefined && change.status !== 'loading') return;
  const url = change.url ?? tab.url;
  if (!url) return;

  const last = lastSeen.get(tabId);
  if (last && last.url === url && now - last.at < REPEAT_WINDOW_MS) return;
  lastSeen.set(tabId, { url, at: now });

  const match = resolvePathReplace(url, await loadPathReplaceRules());
  if (!match) return;

  const confirmMessage = match.mode === 'confirm' ? t('path_replace_confirm', [match.url]) : null;
  await chrome.scripting.executeScript({
    target: { tabId },
    func: replaceInPage,
    args: [url, match.url, confirmMessage],
  });
}

/** A closed tab cannot navigate any more. */
export function forgetTab(tabId: number): void {
  lastSeen.delete(tabId);
}
