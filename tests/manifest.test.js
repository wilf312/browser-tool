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

  it('injects the Meet auto join on meet.google.com', () => {
    const [contentScript] = manifest.content_scripts;
    expect(contentScript.matches).toContain('https://meet.google.com/*');
    expect(contentScript.js).toEqual(['src/content/meet-loader.js']);
  });

  it('exposes the modules the content script imports at runtime', () => {
    // The loader pulls in `src/content/meet-auto-join.js`, which imports `src/lib/*`.
    const [entry] = manifest.web_accessible_resources;
    expect(entry.resources).toEqual(expect.arrayContaining(['src/content/*.js', 'src/lib/*.js']));
    expect(entry.matches).toContain('https://meet.google.com/*');
  });

  it('points every referenced file at something that exists', () => {
    const referenced = [
      manifest.background.service_worker,
      manifest.options_page,
      manifest.action.default_popup,
      ...manifest.content_scripts.flatMap((script) => script.js),
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
