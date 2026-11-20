/** Persistence for the path replace rules, backed by `chrome.storage.sync`. */

import { DEFAULT_PATH_REPLACE_MODE, isPathReplaceMode } from './path-replace';
import { onSyncValueChanged, readSync, writeSync } from './sync-storage';
import type { PathReplaceRule } from './types';

export const PATH_REPLACE_STORAGE_KEY = 'pathReplaceRules';

let idCounter = 0;

function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-p${idCounter.toString(36)}`;
}

/** Build a blank (or pre-filled) rule ready to be stored. New rules ask before replacing. */
export function createPathReplaceRule({
  pattern = '',
  from = '',
  to = '',
  mode = DEFAULT_PATH_REPLACE_MODE,
}: Partial<Omit<PathReplaceRule, 'id'>> = {}): PathReplaceRule {
  return {
    id: newId(),
    pattern: String(pattern),
    from: String(from),
    to: String(to),
    mode: isPathReplaceMode(mode) ? mode : DEFAULT_PATH_REPLACE_MODE,
  };
}

/** Coerce anything read from storage (or a settings file) into a well formed rule list. */
export function sanitizePathReplaceRules(raw: unknown): PathReplaceRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (rule): rule is Record<string, unknown> =>
        rule !== null && typeof rule === 'object' && !Array.isArray(rule),
    )
    .map((rule) => ({
      id: typeof rule.id === 'string' && rule.id ? rule.id : newId(),
      pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
      from: typeof rule.from === 'string' ? rule.from : '',
      to: typeof rule.to === 'string' ? rule.to : '',
      mode: isPathReplaceMode(rule.mode) ? rule.mode : DEFAULT_PATH_REPLACE_MODE,
    }));
}

/** Read the rules. Resolves to `[]` when nothing is stored or outside the extension. */
export async function loadPathReplaceRules(): Promise<PathReplaceRule[]> {
  return sanitizePathReplaceRules(await readSync(PATH_REPLACE_STORAGE_KEY));
}

/** Persist the rules. */
export async function savePathReplaceRules(rules: PathReplaceRule[]): Promise<void> {
  await writeSync(PATH_REPLACE_STORAGE_KEY, sanitizePathReplaceRules(rules));
}

/** Subscribe to rule changes made in another context (popup, options, other device). */
export function onPathReplaceRulesChanged(callback: (rules: PathReplaceRule[]) => void): void {
  onSyncValueChanged(PATH_REPLACE_STORAGE_KEY, (newValue) =>
    callback(sanitizePathReplaceRules(newValue)),
  );
}
