import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

describe('manifest.json', () => {
  it('is a manifest v3 extension', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+(\.\d+)*$/);
  });

  it('requests the permissions the redirect needs', () => {
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toContain('*://*.atlassian.net/*');
  });

  it('runs the background script as a module', () => {
    expect(manifest.background.type).toBe('module');
  });

  it('points every referenced file at something that exists', () => {
    const referenced = [
      manifest.background.service_worker,
      manifest.options_page,
      manifest.action.default_popup,
    ];
    for (const path of referenced) {
      expect(path, `${path} is referenced by the manifest`).toBeTruthy();
      expect(existsSync(new URL(path, `file://${root}`)), `${path} exists`).toBe(true);
    }
  });

  it('opens the same settings page from the toolbar and from the options entry', () => {
    expect(manifest.action.default_popup).toBe(manifest.options_page);
  });
});
