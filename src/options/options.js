/** Wires the settings page to storage. */

import { loadRules, saveRules, onRulesChanged } from '../lib/storage.js';
import { loadMeetSettings, saveMeetSettings, onMeetSettingsChanged } from '../lib/meet-settings.js';
import { debounce } from '../lib/debounce.js';
import { createRulesTable } from './rules-table.js';

const tbody = document.getElementById('rules');
const addButton = document.getElementById('add');
const status = document.getElementById('status');
const meetEnabled = document.getElementById('meet-enabled');
const meetInterval = document.getElementById('meet-interval');
const meetStatus = document.getElementById('meet-status');

/** Show `保存しました` in `element`, then clear it. */
function createStatus(element) {
  let timer = null;
  return (message) => {
    element.textContent = message;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      element.textContent = '';
    }, 1500);
  };
}

const showRulesStatus = createStatus(status);
const showMeetStatus = createStatus(meetStatus);

const persist = debounce(async (rules) => {
  try {
    await saveRules(rules);
    showRulesStatus('保存しました');
  } catch (error) {
    console.error('[browser-tool] failed to save rules', error);
    status.textContent = '保存に失敗しました';
  }
}, 400);

const table = createRulesTable({ tbody, addButton, onChange: persist });

// A pending save must not be lost when the popup closes.
window.addEventListener('pagehide', () => persist.flush());

loadRules().then((rules) => table.setRules(rules));

// Another context (the options tab, the popup, another device) edited the rules.
onRulesChanged((rules) => {
  if (tbody.contains(document.activeElement)) return; // don't clobber an edit in progress
  table.setRules(rules);
});

function renderMeetSettings(settings) {
  meetEnabled.checked = settings.enabled;
  meetInterval.value = String(settings.intervalMinutes);
}

// The Meet settings are two controls, so they are written straight away.
async function persistMeetSettings() {
  try {
    await saveMeetSettings({
      enabled: meetEnabled.checked,
      intervalMinutes: Number(meetInterval.value),
    });
    showMeetStatus('保存しました');
  } catch (error) {
    console.error('[browser-tool] failed to save the Meet settings', error);
    meetStatus.textContent = '保存に失敗しました';
  }
}

meetEnabled.addEventListener('change', persistMeetSettings);
meetInterval.addEventListener('change', persistMeetSettings);

loadMeetSettings().then(renderMeetSettings);

onMeetSettingsChanged((settings) => {
  if (document.activeElement === meetInterval) return;
  renderMeetSettings(settings);
});
