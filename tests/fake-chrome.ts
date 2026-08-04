/**
 * A stand-in for the extension APIs the modules under test reach for.
 *
 * `globalThis.chrome` is typed as the real API surface, so the cast is done
 * here — once — instead of in every test.
 */

import { vi, type Mock } from 'vitest';

export type StorageChange = Record<string, { newValue?: unknown; oldValue?: unknown }>;
export type ChangeListener = (changes: StorageChange, areaName: string) => void;

export interface FakeChromeOptions {
  /** What `chrome.storage.sync` already holds. */
  storage?: Record<string, unknown>;
  /** What `chrome.declarativeNetRequest` already holds. */
  dynamicRules?: Array<{ id: number }>;
}

export type RuntimeListener = () => unknown;

export interface FakeChrome {
  store: Record<string, unknown>;
  listeners: ChangeListener[];
  sync: {
    get: Mock<(key: string) => Promise<Record<string, unknown>>>;
    set: Mock<(items: Record<string, unknown>) => Promise<void>>;
  };
  dnr: {
    getDynamicRules: Mock<() => Promise<Array<{ id: number }> | undefined>>;
    updateDynamicRules: Mock<(options: { removeRuleIds: number[]; addRules: unknown[] }) => Promise<void>>;
  };
  /** What the service worker registered for the browser lifecycle events. */
  runtime: {
    installed: RuntimeListener[];
    startup: RuntimeListener[];
  };
  /** Pretend another context (another tab, the popup, another device) wrote a key. */
  emitChange(key: string, newValue: unknown, areaName?: string): void;
  /** Pretend the browser installed the extension / started up. */
  emitRuntime(event: 'installed' | 'startup'): void;
}

export function installFakeChrome({ storage = {}, dynamicRules = [] }: FakeChromeOptions = {}): FakeChrome {
  const store: Record<string, unknown> = { ...storage };
  const listeners: ChangeListener[] = [];
  const runtime = { installed: [] as RuntimeListener[], startup: [] as RuntimeListener[] };

  const fake: FakeChrome = {
    store,
    listeners,
    runtime,
    sync: {
      get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
    },
    dnr: {
      getDynamicRules: vi.fn(async () => dynamicRules),
      updateDynamicRules: vi.fn(async () => {}),
    },
    emitChange(key, newValue, areaName = 'sync') {
      for (const listener of listeners) listener({ [key]: { newValue } }, areaName);
    },
    emitRuntime(event) {
      for (const listener of runtime[event]) listener();
    },
  };

  globalThis.chrome = {
    storage: {
      sync: fake.sync,
      onChanged: { addListener: (listener: ChangeListener) => listeners.push(listener) },
    },
    declarativeNetRequest: fake.dnr,
    runtime: {
      onInstalled: { addListener: (listener: RuntimeListener) => runtime.installed.push(listener) },
      onStartup: { addListener: (listener: RuntimeListener) => runtime.startup.push(listener) },
    },
  } as unknown as typeof chrome;

  return fake;
}

export function uninstallFakeChrome(): void {
  Reflect.deleteProperty(globalThis, 'chrome');
}
