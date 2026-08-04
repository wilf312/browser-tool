/**
 * Pure redirect logic, shared by the background service worker and the tests.
 *
 * A rule is `{ id, from, to, enabled }` where `from` / `to` are hosts such as
 * `a.atlassian.net`. Only the host is swapped: pathname, query and hash are
 * carried over so `https://a.atlassian.net/browse/XAPP-134` lands on
 * `https://b.atlassian.net/browse/XAPP-134`.
 */

/** Turn user input such as `https://A.atlassian.net/browse/X` into `a.atlassian.net`. */
export function normalizeHost(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return '';
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  return withoutScheme.split(/[/?#]/)[0];
}

/** A rule is usable only when both hosts are set and actually differ. */
function normalizeRule(rule) {
  if (!rule) return null;
  const from = normalizeHost(rule.from);
  const to = normalizeHost(rule.to);
  if (!from || !to || from === to) return null;
  return { from, to };
}

/**
 * Resolve `url` against `rules`.
 * @returns {string|null} the redirect target, or null when nothing matches.
 */
export function resolveRedirect(url, rules) {
  if (typeof url !== 'string' || !url) return null;
  if (!Array.isArray(rules) || rules.length === 0) return null;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  for (const rule of rules) {
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
export function buildDnrRules(rules) {
  if (!Array.isArray(rules)) return [];

  const dnrRules = [];
  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    const normalized = normalizeRule(rule);
    if (!normalized) continue;

    dnrRules.push({
      id: dnrRules.length + 1,
      priority: 1,
      action: {
        type: 'redirect',
        redirect: { transform: { host: normalized.to } },
      },
      condition: {
        urlFilter: `||${normalized.from}/`,
        resourceTypes: ['main_frame'],
      },
    });
  }

  return dnrRules;
}
