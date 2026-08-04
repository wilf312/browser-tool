/** Persistence for the redirect rules, backed by `chrome.storage.sync`. */

import { readSync, writeSync, onSyncValueChanged } from './sync-storage.js';

export const STORAGE_KEY = 'redirectRules';

let idCounter = 0;

function newId() {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

/** Build a blank (or pre-filled) rule ready to be stored. */
export function createRule({ from = '', to = '', enabled = true } = {}) {
  return { id: newId(), from: String(from), to: String(to), enabled: Boolean(enabled) };
}

/** Coerce anything read from storage into a well formed rule list. */
export function sanitizeRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((rule) => rule !== null && typeof rule === 'object' && !Array.isArray(rule))
    .map((rule) => ({
      id: typeof rule.id === 'string' && rule.id ? rule.id : newId(),
      from: typeof rule.from === 'string' ? rule.from : '',
      to: typeof rule.to === 'string' ? rule.to : '',
      enabled: rule.enabled === undefined ? true : Boolean(rule.enabled),
    }));
}

/** Read the rules. Resolves to `[]` when nothing is stored or outside the extension. */
export async function loadRules() {
  return sanitizeRules(await readSync(STORAGE_KEY));
}

/** Persist the rules. */
export async function saveRules(rules) {
  await writeSync(STORAGE_KEY, sanitizeRules(rules));
}

/** Subscribe to rule changes made in another context (popup, options, other device). */
export function onRulesChanged(callback) {
  onSyncValueChanged(STORAGE_KEY, (newValue) => callback(sanitizeRules(newValue)));
}
