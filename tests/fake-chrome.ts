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

export interface FakeMenuClick {
  menuItemId: string | number;
  pageUrl?: string;
}

export type MenuClickListener = (info: FakeMenuClick, tab?: FakeTab) => unknown;
export type MessageListener = (
  message: unknown,
  sender: object,
  sendResponse: (response: unknown) => void,
) => unknown;

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
  contextMenus: {
    create: Mock<(properties: chrome.contextMenus.CreateProperties) => string | number>;
    removeAll: Mock<() => Promise<void>>;
  };
  /** Whether the offscreen document is open, as `hasDocument` reports it. */
  offscreenOpen: boolean;
  offscreen: {
    createDocument: Mock<(parameters: chrome.offscreen.CreateParameters) => Promise<void>>;
    closeDocument: Mock<() => Promise<void>>;
    hasDocument: Mock<() => Promise<boolean>>;
  };
  /**
   * Delivers a message to the `onMessage` listeners, the way it reaches the
   * other contexts of the extension, and resolves with the first response.
   */
  sendMessage: Mock<(message: unknown) => Promise<unknown>>;
  /** What the service worker registered for the browser lifecycle events. */
  runtime: {
    installed: RuntimeListener[];
    startup: RuntimeListener[];
  };
  /** What the service worker registered for the alarm, tab, menu and message events. */
  events: {
    alarm: AlarmListener[];
    tabRemoved: TabRemovedListener[];
    menuClicked: MenuClickListener[];
    message: MessageListener[];
  };
  /** Pretend another context (another tab, the popup, another device) wrote a key. */
  emitChange(key: string, newValue: unknown, areaName?: string): void;
  /** Pretend the browser installed the extension / started up. */
  emitRuntime(event: 'installed' | 'startup'): void;
  /** Pretend an alarm fired. */
  emitAlarm(name: string): void;
  /** Pretend the user closed a tab. */
  emitTabRemoved(tabId: number): void;
  /** Pretend the user picked one of the extension's context menu items. */
  emitMenuClick(info: FakeMenuClick, tab?: FakeTab): void;
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
  const events = {
    alarm: [] as AlarmListener[],
    tabRemoved: [] as TabRemovedListener[],
    menuClicked: [] as MenuClickListener[],
    message: [] as MessageListener[],
  };

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
    contextMenus: {
      create: vi.fn((properties: chrome.contextMenus.CreateProperties) => properties.id ?? 0),
      removeAll: vi.fn(async () => {}),
    },
    offscreenOpen: false,
    offscreen: {
      createDocument: vi.fn(async () => {
        if (fake.offscreenOpen) throw new Error('Only a single offscreen document may be created.');
        fake.offscreenOpen = true;
      }),
      closeDocument: vi.fn(async () => {
        if (!fake.offscreenOpen) throw new Error('No current offscreen document.');
        fake.offscreenOpen = false;
      }),
      hasDocument: vi.fn(async () => fake.offscreenOpen),
    },
    sendMessage: vi.fn(async (message: unknown) => {
      let response: unknown;
      let answered = false;
      for (const listener of events.message) {
        listener(message, {}, (value) => {
          if (answered) return;
          answered = true;
          response = value;
        });
      }
      return response;
    }),
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
    emitMenuClick(info, tab) {
      for (const listener of events.menuClicked) listener(info, tab);
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
    contextMenus: {
      create: fake.contextMenus.create,
      removeAll: fake.contextMenus.removeAll,
      onClicked: {
        addListener: (listener: MenuClickListener) => events.menuClicked.push(listener),
      },
    },
    offscreen: {
      ...fake.offscreen,
      Reason: { CLIPBOARD: 'CLIPBOARD' },
    },
    runtime: {
      onInstalled: { addListener: (listener: RuntimeListener) => runtime.installed.push(listener) },
      onStartup: { addListener: (listener: RuntimeListener) => runtime.startup.push(listener) },
      onMessage: { addListener: (listener: MessageListener) => events.message.push(listener) },
      sendMessage: fake.sendMessage,
    },
  } as unknown as typeof chrome;

  return fake;
}

export function uninstallFakeChrome(): void {
  Reflect.deleteProperty(globalThis, 'chrome');
}
