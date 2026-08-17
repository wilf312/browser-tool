import { describe, it, expect, afterEach } from 'vitest';
import { readSession, writeSession } from './session-storage';
import { installFakeChrome, uninstallFakeChrome } from '../../tests/fake-chrome';

afterEach(() => {
  uninstallFakeChrome();
});

describe('readSession', () => {
  it('reads the stored value', async () => {
    installFakeChrome({ session: { jobs: [1, 2] } });

    await expect(readSession('jobs')).resolves.toEqual([1, 2]);
  });

  it('resolves to undefined when nothing is stored', async () => {
    installFakeChrome();

    await expect(readSession('jobs')).resolves.toBeUndefined();
  });

  it('resolves to undefined outside the extension', async () => {
    await expect(readSession('jobs')).resolves.toBeUndefined();
  });
});

describe('writeSession', () => {
  it('writes the value under the key', async () => {
    const chrome = installFakeChrome();

    await writeSession('jobs', { 7: 'job' });

    expect(chrome.sessionStore.jobs).toEqual({ 7: 'job' });
  });

  it('does nothing outside the extension', async () => {
    await expect(writeSession('jobs', {})).resolves.toBeUndefined();
  });
});
