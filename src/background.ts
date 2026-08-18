/**
 * Service worker: mirrors the stored rules into declarativeNetRequest so the
 * redirect happens before the retired domain is ever requested, and runs the
 * reload timers whose alarms wake it back up.
 */

import { loadRules, onRulesChanged } from './lib/storage';
import { syncDynamicRules } from './lib/dnr-sync';
import { runReloadAlarm, stopReloadJob } from './lib/reload-jobs';

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

// The worker also wakes up on its own; re-sync so a restart never loses the rules.
refresh();
