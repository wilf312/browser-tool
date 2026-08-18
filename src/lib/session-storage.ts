/**
 * Thin wrapper around `chrome.storage.session`.
 *
 * Where `sync-storage` holds the settings, this holds what is only true of the
 * browser that is running right now — tab ids mean nothing after a restart, and
 * the session area is emptied for us then. Like the sync wrapper, every helper
 * degrades to a no-op outside the extension so callers never guard for it.
 */

function sessionArea(): chrome.storage.SessionStorageArea | null {
  return globalThis.chrome?.storage?.session ?? null;
}

/** Read one key. Resolves to `undefined` when nothing is stored. */
export async function readSession(key: string): Promise<unknown> {
  const area = sessionArea();
  if (!area) return undefined;
  const stored = await area.get(key);
  return stored?.[key];
}

/** Write one key. */
export async function writeSession(key: string, value: unknown): Promise<void> {
  const area = sessionArea();
  if (!area) return;
  await area.set({ [key]: value });
}
