/**
 * Service worker: mirrors the stored rules into declarativeNetRequest so the
 * redirect happens before the retired domain is ever requested.
 */

import { loadRules, onRulesChanged } from './lib/storage.js';
import { syncDynamicRules } from './lib/dnr-sync.js';

async function refresh() {
  try {
    await syncDynamicRules(await loadRules());
  } catch (error) {
    console.error('[browser-tool] failed to sync redirect rules', error);
  }
}

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);

onRulesChanged((rules) => {
  syncDynamicRules(rules).catch((error) => {
    console.error('[browser-tool] failed to sync redirect rules', error);
  });
});

// The worker also wakes up on its own; re-sync so a restart never loses the rules.
refresh();
