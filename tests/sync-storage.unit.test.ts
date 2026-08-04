/**
 * The wrapper is exercised through `storage` and `meet-settings` too; what is
 * covered here is the behaviour those two rely on but never provoke — a page
 * without the extension apis, and a change notification that is not ours.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readSync, writeSync, onSyncValueChanged } from '../src/lib/sync-storage';
import { installFakeChrome, uninstallFakeChrome, type ChangeListener } from './fake-chrome';

beforeEach(() => {
  uninstallFakeChrome();
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('readSync', () => {
  it('reads the stored value', async () => {
    installFakeChrome({ storage: { greeting: 'hello' } });
    await expect(readSync('greeting')).resolves.toBe('hello');
  });

  it('resolves to undefined for a key that was never written', async () => {
    installFakeChrome({ storage: { greeting: 'hello' } });
    await expect(readSync('missing')).resolves.toBeUndefined();
  });

  it('resolves to undefined outside the extension', async () => {
    await expect(readSync('greeting')).resolves.toBeUndefined();
  });

  it('resolves to undefined when chrome has no storage api', async () => {
    globalThis.chrome = {} as unknown as typeof chrome;
    await expect(readSync('greeting')).resolves.toBeUndefined();
  });
});

describe('writeSync', () => {
  it('writes one key without disturbing the others', async () => {
    const chrome = installFakeChrome({ storage: { keep: 1 } });

    await writeSync('greeting', 'hello');

    expect(chrome.sync.set).toHaveBeenCalledWith({ greeting: 'hello' });
    expect(chrome.store).toEqual({ keep: 1, greeting: 'hello' });
  });

  it('does nothing outside the extension', async () => {
    await expect(writeSync('greeting', 'hello')).resolves.toBeUndefined();
  });
});

describe('onSyncValueChanged', () => {
  it('reports the new value of the watched key', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();

    onSyncValueChanged('greeting', cb);
    chrome.emitChange('greeting', 'hello');

    expect(cb).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('reports a cleared key as undefined', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();

    onSyncValueChanged('greeting', cb);
    chrome.emitChange('greeting', undefined);

    expect(cb).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it('ignores a change notification without any changes', () => {
    const chrome = installFakeChrome();
    const cb = vi.fn();

    onSyncValueChanged('greeting', cb);
    const [listener] = chrome.listeners as ChangeListener[];
    listener(undefined as never, 'sync');

    expect(cb).not.toHaveBeenCalled();
  });

  it('subscribes each caller separately', () => {
    const chrome = installFakeChrome();
    const first = vi.fn();
    const second = vi.fn();

    onSyncValueChanged('greeting', first);
    onSyncValueChanged('other', second);
    chrome.emitChange('greeting', 'hello');

    expect(first).toHaveBeenCalledExactlyOnceWith('hello');
    expect(second).not.toHaveBeenCalled();
  });

  it('does nothing outside the extension', () => {
    const cb = vi.fn();
    expect(() => onSyncValueChanged('greeting', cb)).not.toThrow();
    expect(cb).not.toHaveBeenCalled();
  });
});
