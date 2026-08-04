/** Wires the rules table to storage. */

import { loadRules, saveRules, onRulesChanged } from '../lib/storage.js';
import { debounce } from '../lib/debounce.js';
import { createRulesTable } from './rules-table.js';

const tbody = document.getElementById('rules');
const addButton = document.getElementById('add');
const status = document.getElementById('status');

let clearStatusTimer = null;

function showSaved() {
  status.textContent = '保存しました';
  if (clearStatusTimer !== null) clearTimeout(clearStatusTimer);
  clearStatusTimer = setTimeout(() => {
    status.textContent = '';
  }, 1500);
}

const persist = debounce(async (rules) => {
  try {
    await saveRules(rules);
    showSaved();
  } catch (error) {
    console.error('[jira-domain-redirect] failed to save rules', error);
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
