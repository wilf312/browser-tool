/**
 * A stand-in for the extension APIs the modules under test reach for.
 *
 * `globalThis.chrome` is typed as the real API surface, so the cast is done
 * here — once — instead of in every test.
 */

import { vi, type Mock } from 'vitest';

export type StorageChange = Record<string, { newValue?: unknown; oldValue?: unknown }>;
export type ChangeListener = (changes: StorageChange, areaName: string) => void;

export interface FakeTab {
  id: number;
  url?: string;
  title?: string;
}

export interface FakeAlarm {
  when?: number;
  periodInMinutes?: number;
}

export interface FakeChromeOptions {
  /** What `chrome.storage.sync` already holds. */
  storage?: Record<string, unknown>;
  /** What `chrome.storage.session` already holds. */
  session?: Record<string, unknown>;
  /** What `chrome.declarativeNetRequest` already holds. */
  dynamicRules?: Array<{ id: number }>;
  /** The tab `chrome.tabs.query` reports as active. */
  activeTab?: FakeTab | null;
  /**
   * The tab the page under test runs in — a settings page opened as a tab. The
   * popup has none, which is the default.
   */
  currentTab?: FakeTab | null;
}

export type RuntimeListener = () => unknown;
export type AlarmListener = (alarm: { name: string }) => unknown;
export type TabRemovedListener = (tabId: number) => unknown;

export interface FakeChrome {
  store: Record<string, unknown>;
  sessionStore: Record<string, unknown>;
  listeners: ChangeListener[];
  /** The alarms that are currently set, keyed by name. */
  alarmStore: Map<string, FakeAlarm>;
  sync: {
    get: Mock<(key: string) => Promise<Record<string, unknown>>>;
    set: Mock<(items: Record<string, unknown>) => Promise<void>>;
  };
  session: {
    get: Mock<(key: string) => Promise<Record<string, unknown>>>;
    set: Mock<(items: Record<string, unknown>) => Promise<void>>;
  };
  dnr: {
    getDynamicRules: Mock<() => Promise<Array<{ id: number }> | undefined>>;
    updateDynamicRules: Mock<
      (options: { removeRuleIds: number[]; addRules: unknown[] }) => Promise<void>
    >;
  };
  alarms: {
    create: Mock<(name: string, info: FakeAlarm) => void>;
    clear: Mock<(name: string) => Promise<boolean>>;
  };
  tabs: {
    query: Mock<(info: Record<string, unknown>) => Promise<FakeTab[]>>;
    getCurrent: Mock<() => Promise<FakeTab | undefined>>;
    reload: Mock<(tabId: number) => Promise<void>>;
  };
  /** What the service worker registered for the browser lifecycle events. */
  runtime: {
    installed: RuntimeListener[];
    startup: RuntimeListener[];
  };
  /** What the service worker registered for the alarm and tab events. */
  events: {
    alarm: AlarmListener[];
    tabRemoved: TabRemovedListener[];
  };
  /** Pretend another context (another tab, the popup, another device) wrote a key. */
  emitChange(key: string, newValue: unknown, areaName?: string): void;
  /** Pretend the browser installed the extension / started up. */
  emitRuntime(event: 'installed' | 'startup'): void;
  /** Pretend an alarm fired. */
  emitAlarm(name: string): void;
  /** Pretend the user closed a tab. */
  emitTabRemoved(tabId: number): void;
}

/** One storage area, backed by a plain object the test can read afterwards. */
function fakeArea(target: Record<string, unknown>) {
  return {
    get: vi.fn(async (key: string) => (key in target ? { [key]: target[key] } : {})),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(target, items);
    }),
  };
}

export function installFakeChrome({
  storage = {},
  session = {},
  dynamicRules = [],
  activeTab = null,
  currentTab = null,
}: FakeChromeOptions = {}): FakeChrome {
  const store: Record<string, unknown> = { ...storage };
  const sessionStore: Record<string, unknown> = { ...session };
  const listeners: ChangeListener[] = [];
  const alarmStore = new Map<string, FakeAlarm>();
  const runtime = { installed: [] as RuntimeListener[], startup: [] as RuntimeListener[] };
  const events = { alarm: [] as AlarmListener[], tabRemoved: [] as TabRemovedListener[] };

  const fake: FakeChrome = {
    store,
    sessionStore,
    listeners,
    alarmStore,
    runtime,
    events,
    sync: fakeArea(store),
    session: fakeArea(sessionStore),
    dnr: {
      getDynamicRules: vi.fn(async () => dynamicRules),
      updateDynamicRules: vi.fn(async () => {}),
    },
    alarms: {
      create: vi.fn((name: string, info: FakeAlarm) => {
        alarmStore.set(name, info);
      }),
      clear: vi.fn(async (name: string) => alarmStore.delete(name)),
    },
    tabs: {
      query: vi.fn(async () => (activeTab ? [activeTab] : [])),
      getCurrent: vi.fn(async () => currentTab ?? undefined),
      reload: vi.fn(async () => {}),
    },
    emitChange(key, newValue, areaName = 'sync') {
      for (const listener of listeners) listener({ [key]: { newValue } }, areaName);
    },
    emitRuntime(event) {
      for (const listener of runtime[event]) listener();
    },
    emitAlarm(name) {
      for (const listener of events.alarm) listener({ name });
    },
    emitTabRemoved(tabId) {
      for (const listener of events.tabRemoved) listener(tabId);
    },
  };

  globalThis.chrome = {
    storage: {
      sync: fake.sync,
      session: fake.session,
      onChanged: { addListener: (listener: ChangeListener) => listeners.push(listener) },
    },
    declarativeNetRequest: fake.dnr,
    alarms: {
      create: fake.alarms.create,
      clear: fake.alarms.clear,
      onAlarm: { addListener: (listener: AlarmListener) => events.alarm.push(listener) },
    },
    tabs: {
      query: fake.tabs.query,
      getCurrent: fake.tabs.getCurrent,
      reload: fake.tabs.reload,
      onRemoved: {
        addListener: (listener: TabRemovedListener) => events.tabRemoved.push(listener),
      },
    },
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
