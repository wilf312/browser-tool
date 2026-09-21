#!/usr/bin/env node
/**
 * Packs `dist/` into the ZIP that gets uploaded to the Chrome Web Store.
 *
 * Run it after `npm run build:release` (`npm run package` does both). The
 * checks below are the ones that are cheap here and expensive after an upload
 * is rejected: the archive has to have `manifest.json` at its root, every path
 * the manifest names has to exist, the two version numbers have to agree, and
 * no source map may be shipped.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const distDir = join(root, 'dist');
const releaseDir = join(root, 'release');

/** Aborts with a message that says what to do next, not just what went wrong. */
function fail(message) {
  console.error(`エラー: ${message}`);
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Every file under `dir`, as paths relative to it and with `/` separators. */
function listFiles(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(join(dir, entry.name), path) : [path];
  });
}

if (!existsSync(distDir)) {
  fail('dist/ がありません。先に `npm run build:release` を実行してください');
}

const pkg = readJson(join(root, 'package.json'));
const files = listFiles(distDir);

if (!files.includes('manifest.json')) {
  fail(
    'dist/manifest.json がありません。public/manifest.json がコピーされているか確認してください',
  );
}

const manifest = readJson(join(distDir, 'manifest.json'));

if (manifest.version !== pkg.version) {
  fail(
    `バージョンが一致していません: manifest.json は ${manifest.version}、package.json は ${pkg.version} です`,
  );
}

const referenced = [
  manifest.background?.service_worker,
  manifest.options_page,
  manifest.action?.default_popup,
  ...(manifest.content_scripts ?? []).flatMap((script) => script.js ?? []),
].filter((path) => path !== undefined);

const missing = [...new Set(referenced)].filter((path) => !files.includes(path));
if (missing.length > 0) {
  fail(`manifest.json が参照しているファイルがビルド結果にありません: ${missing.join(', ')}`);
}

const sourcemaps = files.filter((path) => path.endsWith('.map'));
if (sourcemaps.length > 0) {
  fail(
    `source map が dist/ に残っています（${sourcemaps.length} 件）。` +
      '`npm run build:release` でビルドし直してください',
  );
}

const locales = new Set(
  files
    .map((path) => /^_locales\/([^/]+)\/messages\.json$/.exec(path)?.[1])
    .filter((locale) => locale !== undefined),
);
if (locales.size === 0) {
  fail(
    'dist/_locales がありません。多言語化のメッセージがビルド結果に含まれているか確認してください',
  );
}
if (manifest.default_locale !== undefined && !locales.has(manifest.default_locale)) {
  fail(
    `manifest.json の default_locale "${manifest.default_locale}" に対応する ` +
      `_locales/${manifest.default_locale}/messages.json がありません`,
  );
}

mkdirSync(releaseDir, { recursive: true });
const zipPath = join(releaseDir, `${pkg.name}-${manifest.version}.zip`);
rmSync(zipPath, { force: true });

// `zip` keeps `manifest.json` at the root because it runs inside dist/.
// `-X` drops the platform specific extra fields, so the same dist/ produces
// the same archive on any machine.
try {
  execFileSync('zip', ['--quiet', '--recurse-paths', '-X', zipPath, '.'], { cwd: distDir });
} catch (error) {
  if (error.code === 'ENOENT') {
    fail('zip コマンドが見つかりません（macOS / Linux には標準で入っています）');
  }
  throw error;
}

const kilobytes = (statSync(zipPath).size / 1024).toFixed(1);
console.log(`${zipPath} を作成しました（${files.length} ファイル / ${kilobytes} KB）`);
console.log('Chrome Web Store のデベロッパーダッシュボードにこの ZIP をアップロードします');
