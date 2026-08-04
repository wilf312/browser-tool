/**
 * Pure redirect logic, shared by the background service worker and the tests.
 *
 * A rule is `{ id, from, to, enabled }` where `from` / `to` are hosts such as
 * `a.atlassian.net`. Only the host is swapped: pathname, query and hash are
 * carried over so `https://a.atlassian.net/browse/XAPP-134` lands on
 * `https://b.atlassian.net/browse/XAPP-134`.
 */

import type { RedirectRule } from './types';

/** Turn user input such as `https://A.atlassian.net/browse/X` into `a.atlassian.net`. */
export function normalizeHost(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  return withoutScheme.split(/[/?#]/)[0];
}

/** A rule is usable only when both hosts are set and actually differ. */
function normalizeRule(rule: Partial<RedirectRule> | null | undefined) {
  if (!rule) return null;
  const from = normalizeHost(rule.from);
  const to = normalizeHost(rule.to);
  if (!from || !to || from === to) return null;
  return { from, to };
}

/**
 * Resolve `url` against `rules`.
 * @returns the redirect target, or null when nothing matches.
 */
export function resolveRedirect(url: unknown, rules: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  if (!Array.isArray(rules) || rules.length === 0) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  for (const rule of rules as Array<Partial<RedirectRule> | null>) {
    if (!rule || rule.enabled === false) continue;
    const normalized = normalizeRule(rule);
    if (!normalized) continue;
    if (parsed.host.toLowerCase() !== normalized.from) continue;

    const target = new URL(parsed.toString());
    target.host = normalized.to;
    return target.toString();
  }

  return null;
}

/** Translate rules into declarativeNetRequest dynamic rules (ids start at 1). */
export function buildDnrRules(rules: unknown): chrome.declarativeNetRequest.Rule[] {
  if (!Array.isArray(rules)) return [];

  const dnrRules: chrome.declarativeNetRequest.Rule[] = [];
  for (const rule of rules as Array<Partial<RedirectRule> | null>) {
    if (!rule || rule.enabled === false) continue;
    const normalized = normalizeRule(rule);
    if (!normalized) continue;

    dnrRules.push({
      id: dnrRules.length + 1,
      priority: 1,
      action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType.REDIRECT,
        redirect: { transform: { host: normalized.to } },
      },
      condition: {
        urlFilter: `||${normalized.from}/`,
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType.MAIN_FRAME],
      },
    });
  }

  return dnrRules;
}
