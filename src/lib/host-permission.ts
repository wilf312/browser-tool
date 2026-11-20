/**
 * Thin wrapper around `chrome.permissions` for the optional host permissions.
 *
 * Like the storage helpers, everything degrades outside the extension: nothing
 * is granted and nothing can be asked for.
 */

function permissionsApi(): typeof chrome.permissions | null {
  return globalThis.chrome?.permissions ?? null;
}

/** Whether the extension may already run on `origin` (a match pattern). */
export async function hasHostPermission(origin: string): Promise<boolean> {
  const api = permissionsApi();
  if (!api) return false;
  try {
    return await api.contains({ origins: [origin] });
  } catch {
    return false;
  }
}

/**
 * Ask the user to let the extension run on `origin`. Chrome only shows the
 * prompt from a user gesture, so call this straight from a click handler.
 */
export async function requestHostPermission(origin: string): Promise<boolean> {
  const api = permissionsApi();
  if (!api) return false;
  return api.request({ origins: [origin] });
}

/** Called whenever a permission is granted or taken back (also from chrome://extensions). */
export function onHostPermissionsChanged(callback: () => void): () => void {
  const api = permissionsApi();
  if (!api?.onAdded || !api.onRemoved) return () => {};
  api.onAdded.addListener(callback);
  api.onRemoved.addListener(callback);
  return () => {
    api.onAdded.removeListener(callback);
    api.onRemoved.removeListener(callback);
  };
}
