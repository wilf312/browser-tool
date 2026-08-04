// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STORAGE_KEY } from '../src/lib/storage.js';

const html = readFileSync(resolve(process.cwd(), 'src/options/options.html'), 'utf8');
const bodyHtml = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)[1];

let store;
let changeListeners;

function installFakeChrome(initialRules) {
  store = { [STORAGE_KEY]: initialRules };
  changeListeners = [];
  globalThis.chrome = {
    storage: {
      sync: {
        get: vi.fn(async (key) => (store[key] === undefined ? {} : { [key]: store[key] })),
        set: vi.fn(async (items) => Object.assign(store, items)),
      },
      onChanged: { addListener: vi.fn((cb) => changeListeners.push(cb)) },
    },
  };
}

/** Mount options.html + options.js and wait for the initial load to settle. */
async function mount(initialRules = []) {
  document.body.innerHTML = bodyHtml;
  installFakeChrome(initialRules);
  vi.resetModules();
  await import('../src/options/options.js');
  await vi.waitFor(() => expect(chrome.storage.sync.get).toHaveBeenCalled());
  await Promise.resolve();
  await Promise.resolve();
}

/** Let the debounced save fire and its promise resolve. */
async function settleSave() {
  await vi.advanceTimersByTimeAsync(500);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.chrome;
});

describe('options page', () => {
  it('renders the stored rules into the table', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const rows = document.querySelectorAll('#rules tr[data-id]');
    expect(rows).toHaveLength(1);
    expect(rows[0].querySelector('.rule-from').value).toBe('a.atlassian.net');
    expect(rows[0].querySelector('.rule-to').value).toBe('b.atlassian.net');
    expect(rows[0].querySelector('.rule-enabled').checked).toBe(true);
  });

  it('shows the empty state when nothing is stored', async () => {
    await mount([]);
    expect(document.querySelector('#rules .empty')).toBeTruthy();
  });

  it('persists a toggle after the debounce', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const checkbox = document.querySelector('#rules .rule-enabled');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(chrome.storage.sync.set).not.toHaveBeenCalled();
    await settleSave();
    expect(store[STORAGE_KEY]).toEqual([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false },
    ]);
  });

  it('collapses typing into a single write', async () => {
    await mount([{ id: '1', from: '', to: '', enabled: true }]);

    const input = document.querySelector('#rules .rule-from');
    for (const value of ['a', 'a.', 'a.atlassian.net']) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await settleSave();
    expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1);
    expect(store[STORAGE_KEY][0].from).toBe('a.atlassian.net');
  });

  it('adds a rule and persists it', async () => {
    await mount([]);

    document.getElementById('add').click();
    await settleSave();

    expect(document.querySelectorAll('#rules tr[data-id]')).toHaveLength(1);
    expect(store[STORAGE_KEY]).toHaveLength(1);
    expect(store[STORAGE_KEY][0]).toMatchObject({ from: '', to: '', enabled: true });
  });

  it('deletes a rule and persists the removal', async () => {
    await mount([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
      { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: true },
    ]);

    document.querySelector('#rules tr[data-id="1"] .rule-delete').click();
    await settleSave();

    expect(store[STORAGE_KEY]).toHaveLength(1);
    expect(store[STORAGE_KEY][0].id).toBe('2');
  });

  it('reports the save in the status area', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const checkbox = document.querySelector('#rules .rule-enabled');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    await settleSave();

    expect(document.getElementById('status').textContent).toBe('保存しました');
  });

  it('flushes a pending save when the page is hidden', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const input = document.querySelector('#rules .rule-to');
    input.value = 'z.atlassian.net';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    window.dispatchEvent(new Event('pagehide'));
    await vi.waitFor(() => expect(chrome.storage.sync.set).toHaveBeenCalled());
    expect(store[STORAGE_KEY][0].to).toBe('z.atlassian.net');
  });

  it('picks up rules changed in another context', async () => {
    await mount([]);

    changeListeners[0](
      { [STORAGE_KEY]: { newValue: [{ id: '9', from: 'x.atlassian.net', to: 'y.atlassian.net', enabled: true }] } },
      'sync',
    );

    expect(document.querySelectorAll('#rules tr[data-id]')).toHaveLength(1);
    expect(document.querySelector('#rules .rule-from').value).toBe('x.atlassian.net');
  });

  it('does not clobber a row the user is editing', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const input = document.querySelector('#rules .rule-from');
    input.focus();

    changeListeners[0]({ [STORAGE_KEY]: { newValue: [] } }, 'sync');

    expect(document.querySelectorAll('#rules tr[data-id]')).toHaveLength(1);
    expect(document.activeElement).toBe(input);
  });
});
