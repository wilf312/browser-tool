/**
 * The two entry points are import-time side effects, so each test re-imports
 * the module under a fresh mock.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { installFakeChrome, uninstallFakeChrome } from './fake-chrome';

const start = vi.hoisted(() => vi.fn());
vi.mock('../src/content/meet-auto-join', () => ({ start }));

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
    await import('../src/content/main');
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('logs instead of throwing when the auto join cannot start', async () => {
    const error = new Error('no document');
    start.mockImplementation(() => {
      throw error;
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(import('../src/content/main')).resolves.toBeDefined();
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
      await import('../src/options/main');
    });

    expect(root.querySelector('h1')?.textContent).toBe('Browser Tool');
  });

  it('does nothing when the page has no #root', async () => {
    installFakeChrome();

    await act(async () => {
      await expect(import('../src/options/main')).resolves.toBeDefined();
    });
    expect(document.body.innerHTML).toBe('');
  });
});
