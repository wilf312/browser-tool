import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Paths are resolved from the repository root, where vitest is started. */
function fromRoot(path: string): string {
  return resolve(process.cwd(), path);
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(fromRoot(path), 'utf8'));
}

interface Manifest {
  manifest_version: number;
  name: string;
  version: string;
  permissions: string[];
  host_permissions: string[];
  background: { service_worker: string; type: string };
  content_scripts: Array<{ matches: string[]; js: string[]; run_at: string }>;
  web_accessible_resources?: unknown;
  options_page: string;
  action: { default_popup: string; default_title: string };
}

const manifest = readJson('public/manifest.json') as Manifest;
const pkg = readJson('package.json') as { version: string };

/**
 * Every path in the manifest is a build output, so it cannot be checked against
 * the working tree directly. This is the mapping the vite configs implement —
 * keep the two in step.
 */
const BUILD_OUTPUTS: Record<string, string> = {
  'background.js': 'src/background.ts',
  'content/main.js': 'src/content/main.ts',
  'options.html': 'options.html',
};

describe('manifest.json', () => {
  it('is a manifest v3 extension', () => {
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.name).toBeTruthy();
    expect(manifest.version).toMatch(/^\d+(\.\d+)*$/);
  });

  it('ships the same version as the package', () => {
    expect(manifest.version).toBe(pkg.version);
  });

  it('requests the permissions the redirect needs', () => {
    expect(manifest.permissions).toContain('declarativeNetRequest');
    expect(manifest.permissions).toContain('storage');
    expect(manifest.host_permissions).toContain('*://*.atlassian.net/*');
  });

  it('requests the permissions the reload timer needs', () => {
    // The alarm survives the service worker being shut down between two
    // reloads; activeTab is what lets the popup name the tab it will reload,
    // without asking for a look at every site.
    expect(manifest.permissions).toContain('alarms');
    expect(manifest.permissions).toContain('activeTab');
  });

  it('runs the background script as a module', () => {
    expect(manifest.background.type).toBe('module');
  });

  it('injects the Meet auto join on meet.google.com', () => {
    const [contentScript] = manifest.content_scripts;
    expect(contentScript.matches).toContain('https://meet.google.com/*');
    expect(contentScript.js).toEqual(['content/main.js']);
  });

  it('needs no web accessible resources: the content script is bundled', () => {
    expect(manifest.web_accessible_resources).toBeUndefined();
  });

  it('points every referenced file at something the build produces', () => {
    const referenced = [
      manifest.background.service_worker,
      manifest.options_page,
      manifest.action.default_popup,
      ...manifest.content_scripts.flatMap((script) => script.js),
    ];

    for (const path of referenced) {
      const source = BUILD_OUTPUTS[path];
      expect(source, `${path} is built from a known source`).toBeTruthy();
      expect(existsSync(fromRoot(source)), `${source} exists`).toBe(true);
    }
  });

  it('opens the same settings page from the toolbar and from the options entry', () => {
    expect(manifest.action.default_popup).toBe(manifest.options_page);
  });
});
