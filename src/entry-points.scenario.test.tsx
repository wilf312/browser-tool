/**
 * The entry points are import-time side effects, so each test re-imports the
 * module under a fresh mock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { installFakeChrome, uninstallFakeChrome } from '../tests/fake-chrome';

const start = vi.hoisted(() => vi.fn());
vi.mock('./content/meet-auto-join', () => ({ start }));

beforeEach(() => {
  vi.resetModules();
  start.mockReset();
  document.body.innerHTML = '';
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('content script entry point', () => {
  it('starts the Meet auto join', async () => {
    await import('./content/main');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('logs instead of throwing when the auto join cannot start', async () => {
    const error = new Error('no document');
    start.mockImplementation(() => {
      throw error;
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('./content/main')).resolves.toBeDefined();
    expect(logged.mock.calls[0]).toContain(error);
  });
});

describe('settings page entry point', () => {
  it('renders the settings page into #root', async () => {
    installFakeChrome();
    const root = document.createElement('div');
    root.id = 'root';
    document.body.append(root);

    await act(async () => {
      await import('./options/main');
    });

    expect(root.querySelector('h1')?.textContent).toBe('Nanatsudougu');
  });

  it('does nothing when the page has no #root', async () => {
    installFakeChrome();

    await act(async () => {
      await expect(import('./options/main')).resolves.toBeDefined();
    });
    expect(document.body.innerHTML).toBe('');
  });
});

describe('offscreen document entry point', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('copies the text the service worker sends, and cleans up after itself', async () => {
    const chrome = installFakeChrome();
    const copied: string[] = [];
    document.execCommand = vi.fn((command: string) => {
      copied.push(`${command}:${document.querySelector('textarea')?.value ?? ''}`);
      return true;
    });
    await import('./offscreen/main');

    const response = await chrome.sendMessage({ type: 'copy-to-clipboard', text: 'hello' });

    expect(response).toEqual({ ok: true });
    expect(copied).toEqual(['copy:hello']);
    expect(document.body.innerHTML).toBe('');
  });

  it('reports a copy the browser refused', async () => {
    const chrome = installFakeChrome();
    document.execCommand = vi.fn(() => false);
    await import('./offscreen/main');

    const response = await chrome.sendMessage({ type: 'copy-to-clipboard', text: 'hello' });

    expect(response).toEqual({ ok: false });
  });

  it('leaves messages that are not copies unanswered', async () => {
    const chrome = installFakeChrome();
    document.execCommand = vi.fn(() => true);
    await import('./offscreen/main');

    expect(await chrome.sendMessage({ type: 'something-else' })).toBeUndefined();
    expect(await chrome.sendMessage({ type: 'copy-to-clipboard' })).toBeUndefined();
    expect(document.execCommand).not.toHaveBeenCalled();
  });
});
