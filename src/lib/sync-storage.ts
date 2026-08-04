/**
 * Thin wrapper around `chrome.storage.sync`.
 *
 * Every helper degrades to a no-op outside the extension (tests, plain pages),
 * so the callers never have to guard for a missing `chrome`.
 */

function syncArea(): chrome.storage.SyncStorageArea | null {
  return globalThis.chrome?.storage?.sync ?? null;
}

/** Read one key. Resolves to `undefined` when nothing is stored. */
export async function readSync(key: string): Promise<unknown> {
  const area = syncArea();
  if (!area) return undefined;
  const stored = await area.get(key);
  return stored?.[key];
}

/** Write one key. */
export async function writeSync(key: string, value: unknown): Promise<void> {
  const area = syncArea();
  if (!area) return;
  await area.set({ [key]: value });
}

/** Subscribe to changes of one key made in another context (popup, options, other device). */
export function onSyncValueChanged(key: string, callback: (newValue: unknown) => void): void {
  const onChanged = globalThis.chrome?.storage?.onChanged;
  if (!onChanged) return;
  onChanged.addListener((changes, areaName) => {
    if (areaName !== 'sync') return;
    if (!changes || !(key in changes)) return;
    callback(changes[key].newValue);
  });
}
