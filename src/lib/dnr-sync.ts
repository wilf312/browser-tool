/** Keeps the declarativeNetRequest dynamic rules in step with the stored rules. */

import { buildDnrRules } from './redirect';
import type { RedirectRule } from './types';

export async function syncDynamicRules(rules: RedirectRule[]): Promise<void> {
  const dnr = globalThis.chrome?.declarativeNetRequest;
  if (!dnr) return;

  const existing = await dnr.getDynamicRules();
  await dnr.updateDynamicRules({
    removeRuleIds: (existing ?? []).map((rule) => rule.id),
    addRules: buildDnrRules(rules),
  });
}
