/** Keeps the declarativeNetRequest dynamic rules in step with the stored rules. */

import { buildDnrRules } from './redirect.js';

export async function syncDynamicRules(rules) {
  const dnr = globalThis.chrome?.declarativeNetRequest;
  if (!dnr) return;

  const existing = await dnr.getDynamicRules();
  await dnr.updateDynamicRules({
    removeRuleIds: (existing ?? []).map((rule) => rule.id),
    addRules: buildDnrRules(rules),
  });
}
