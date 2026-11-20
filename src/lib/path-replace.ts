/**
 * Pure path replace logic, shared by the service worker, the settings page and the tests.
 *
 * A rule's `pattern` is a host plus an optional path, `*` standing for any run
 * of characters: `*.example.com/docs/*`. On a page that matches, every `from`
 * in the pathname becomes `to`. The host, the query and the hash are left alone.
 */

import type { PathReplaceMode, PathReplaceRule } from './types';

export const PATH_REPLACE_MODES: readonly PathReplaceMode[] = ['always', 'confirm', 'disabled'];

/** What a new rule starts with: asking before anything is replaced. */
export const DEFAULT_PATH_REPLACE_MODE: PathReplaceMode = 'confirm';

export function isPathReplaceMode(value: unknown): value is PathReplaceMode {
  return typeof value === 'string' && (PATH_REPLACE_MODES as readonly string[]).includes(value);
}

/** The pattern split into its host and path halves. `path` is `''` when none was given. */
export interface ParsedPattern {
  /** Lower case, without the port. */
  host: string;
  /** Starts with `/`, or is `''` to match every path. */
  path: string;
}

/** `https://*.Example.com/docs/*` → `{ host: '*.example.com', path: '/docs/*' }`. */
export function parsePattern(value: unknown): ParsedPattern | null {
  if (typeof value !== 'string') return null;
  const withoutScheme = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  if (!withoutScheme) return null;
  const slash = withoutScheme.indexOf('/');
  const hostPart = slash === -1 ? withoutScheme : withoutScheme.slice(0, slash);
  const path = slash === -1 ? '' : withoutScheme.slice(slash);
  const host = hostPart.toLowerCase().replace(/:\d*$/, '');
  if (!host) return null;
  return { host, path };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** A glob where `*` matches any run of characters, anchored at both ends. */
function globToRegExp(glob: string, flags = ''): RegExp {
  const source = glob.split('*').map(escapeRegExp).join('.*');
  return new RegExp(`^${source}$`, flags);
}

/** Does `url` fall under `pattern`? */
export function matchesPattern(url: URL, pattern: ParsedPattern): boolean {
  if (!globToRegExp(pattern.host, 'i').test(url.hostname)) return false;
  if (!pattern.path) return true;
  return globToRegExp(pattern.path).test(url.pathname);
}

/**
 * A rule is usable only when it names a host and a `from`, and `to` does not
 * contain `from` — otherwise the replaced URL would match again, and again.
 */
function usableRule(rule: Partial<PathReplaceRule> | null | undefined) {
  if (!rule || rule.mode === 'disabled' || !isPathReplaceMode(rule.mode)) return null;
  const pattern = parsePattern(rule.pattern);
  const from = typeof rule.from === 'string' ? rule.from : '';
  const to = typeof rule.to === 'string' ? rule.to : '';
  if (!pattern || !from || to.includes(from)) return null;
  return { pattern, from, to, mode: rule.mode };
}

/** Why a rule does nothing, for the settings page to point out. `null` when it is fine. */
export function pathReplaceRuleProblem(
  rule: Pick<PathReplaceRule, 'pattern' | 'from' | 'to'>,
): 'loops' | null {
  if (rule.from && rule.to.includes(rule.from)) return 'loops';
  return null;
}

export interface PathReplaceMatch {
  url: string;
  mode: Exclude<PathReplaceMode, 'disabled'>;
}

/**
 * Resolve `url` against `rules`: the first rule that matches and changes the
 * pathname wins.
 * @returns the URL to go to and how, or null when nothing applies.
 */
export function resolvePathReplace(url: unknown, rules: unknown): PathReplaceMatch | null {
  if (typeof url !== 'string' || !url) return null;
  if (!Array.isArray(rules) || rules.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;

  for (const rule of rules as Array<Partial<PathReplaceRule> | null>) {
    const usable = usableRule(rule);
    if (!usable) continue;
    if (!matchesPattern(parsed, usable.pattern)) continue;

    // The pathname is percent-encoded; compare against the text the user sees.
    const pathname = safeDecode(parsed.pathname);
    if (!pathname.includes(usable.from)) continue;

    const target = new URL(parsed.toString());
    target.pathname = pathname.split(usable.from).join(usable.to);
    const next = target.toString();
    if (next === parsed.toString()) continue;
    return { url: next, mode: usable.mode };
  }

  return null;
}

function safeDecode(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

/**
 * The host permission a pattern needs, as a match pattern for `chrome.permissions`.
 * Match patterns only allow `*` as a whole host or as a leading `*.`, so any
 * other wildcard falls back to every host.
 */
export function permissionOrigin(pattern: unknown): string | null {
  const parsed = parsePattern(pattern);
  if (!parsed) return null;
  const { host } = parsed;
  const rest = host.startsWith('*.') ? host.slice(2) : host;
  if (host === '*' || rest.includes('*') || !rest) return '*://*/*';
  return `*://${host}/*`;
}
