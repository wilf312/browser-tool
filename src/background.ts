/**
 * Service worker: mirrors the stored rules into declarativeNetRequest so the
 * redirect happens before the retired domain is ever requested.
 */

import { loadRules, onRulesChanged } from './lib/storage';
import { syncDynamicRules } from './lib/dnr-sync';

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

// The worker also wakes up on its own; re-sync so a restart never loses the rules.
refresh();
