/**
 * Reading the CI summary GitHub shows above the merge button.
 *
 * GitHub's merge box is a generated React app and its class names churn, but it
 * always spells out the check summary as one of a handful of fixed phrases (in
 * English — GitHub does not localize its own UI). Those phrases are also what a
 * screen reader announces, so they are the stable part of the markup, the same
 * way the Meet buttons are matched by their visible label rather than a class.
 */

export type CiStatus = 'success' | 'pending' | 'failure' | 'unknown';

const FAILURE_PHRASES = ['Some checks were not successful'];
const PENDING_PHRASES = ["Some checks haven't completed yet", 'Some checks have not completed yet'];
const SUCCESS_PHRASES = ['All checks have passed'];

/**
 * @param root where to look; defaults to the page.
 * @returns `'unknown'` when the merge box is not on the page yet, or does not
 * report a check summary at all (e.g. a pull request with no checks configured).
 */
export function findCiStatus(root: ParentNode | null | undefined = globalThis.document): CiStatus {
  if (!root) return 'unknown';

  // `document.textContent` is always null — the aggregated text lives on
  // `documentElement` instead — so a bare `Document` is redirected there.
  const node = 'documentElement' in root ? root.documentElement : root;
  const text = (
    (node as unknown as { textContent: string | null } | null)?.textContent ?? ''
  ).replace(/\s+/g, ' ');

  if (FAILURE_PHRASES.some((phrase) => text.includes(phrase))) return 'failure';
  if (PENDING_PHRASES.some((phrase) => text.includes(phrase))) return 'pending';
  if (SUCCESS_PHRASES.some((phrase) => text.includes(phrase))) return 'success';
  return 'unknown';
}
