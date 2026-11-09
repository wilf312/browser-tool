/**
 * Service worker: mirrors the stored rules into declarativeNetRequest so the
 * redirect happens before the retired domain is ever requested, runs the
 * reload timers whose alarms wake it back up, and answers the context menu
 * items that copy the page's title and URL.
 */

import { loadRules, onRulesChanged } from './lib/storage';
import { syncDynamicRules } from './lib/dnr-sync';
import { runReloadAlarm, stopReloadJob } from './lib/reload-jobs';
import { COPY_TITLE_MENU_ID, COPY_URL_MENU_ID, textToCopy } from './lib/page-copy';
import { writeToClipboard } from './lib/clipboard';
import { t } from './lib/i18n';

async function refresh(): Promise<void> {
  try {
    await syncDynamicRules(await loadRules());
  } catch (error) {
    console.error('[nanatsudougu] failed to sync redirect rules', error);
  }
}

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);

onRulesChanged((rules) => {
  syncDynamicRules(rules).catch((error: unknown) => {
    console.error('[nanatsudougu] failed to sync redirect rules', error);
  });
});

// The reload timers live in alarms, so this is where they are run: the worker is
// shut down between two reloads and started again by the alarm that is due.
chrome.alarms.onAlarm.addListener((alarm) => {
  runReloadAlarm(alarm.name).catch((error: unknown) => {
    console.error('[nanatsudougu] failed to run the reload timer', error);
  });
});

// A closed tab cannot be reloaded; its timer goes with it.
chrome.tabs.onRemoved.addListener((tabId) => {
  stopReloadJob(tabId).catch((error: unknown) => {
    console.error('[nanatsudougu] failed to stop the reload timer', error);
  });
});

// Menu items outlive the worker, so they are created when the extension is
// installed or updated — after clearing the old ones, whose ids would clash.
// Startup builds them again so a change of browser language reaches the labels.
async function setUpPageCopyMenu(): Promise<void> {
  try {
    await chrome.contextMenus.removeAll();
    // `all` includes the toolbar icon's own menu.
    chrome.contextMenus.create({
      id: COPY_TITLE_MENU_ID,
      title: t('menu_copy_page_title'),
      contexts: ['all'],
    });
    chrome.contextMenus.create({
      id: COPY_URL_MENU_ID,
      title: t('menu_copy_page_url'),
      contexts: ['all'],
    });
  } catch (error) {
    console.error('[nanatsudougu] failed to set up the context menu', error);
  }
}

chrome.runtime.onInstalled.addListener(setUpPageCopyMenu);
chrome.runtime.onStartup.addListener(setUpPageCopyMenu);

// Picking a menu item grants activeTab, which is what lets the tab's title be
// read here without the `tabs` permission.
chrome.contextMenus.onClicked.addListener((info, tab) => {
  const text = textToCopy(info.menuItemId, { title: tab?.title, url: tab?.url ?? info.pageUrl });
  if (text === null) return;
  writeToClipboard(text).catch((error: unknown) => {
    console.error('[nanatsudougu] failed to copy to the clipboard', error);
  });
});

// The worker also wakes up on its own; re-sync so a restart never loses the rules.
refresh();
