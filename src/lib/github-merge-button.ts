/**
 * Finding the buttons in GitHub's merge box.
 *
 * Which button is on screen depends on the repository's default merge method
 * and, once the box has been opened, on whether GitHub is still waiting for a
 * commit message to be confirmed. As with the Meet buttons, the label is what
 * stays stable across GitHub's own markup changes, so that is what is matched.
 */

import { clickableButtons, exactLabelsOf } from './page-buttons';

/** The button that opens the merge box, one label per merge method. */
export const MERGE_LABELS = ['Merge pull request', 'Squash and merge', 'Rebase and merge'];

/** The button that finishes the merge once the commit message form is open. */
export const CONFIRM_MERGE_LABELS = [
  'Confirm merge',
  'Confirm squash and merge',
  'Confirm rebase and merge',
];

function findByExactLabel(
  root: ParentNode | null | undefined,
  labels: string[],
): HTMLElement | null {
  const candidates = clickableButtons(root);
  for (const wanted of labels) {
    const match = candidates.find((element) => exactLabelsOf(element).includes(wanted));
    if (match) return match;
  }
  return null;
}

/**
 * @param root where to look; defaults to the page.
 * @returns the button to click to start a merge, or null while the pull
 * request is not mergeable from this screen (already merged, closed, or the
 * merge box has not rendered yet).
 */
export function findMergeButton(
  root: ParentNode | null | undefined = globalThis.document,
): HTMLElement | null {
  return findByExactLabel(root, MERGE_LABELS);
}

/**
 * @param root where to look; defaults to the page.
 * @returns the button that confirms a merge already started with
 * {@link findMergeButton}, or null while the commit message form is not open.
 */
export function findConfirmMergeButton(
  root: ParentNode | null | undefined = globalThis.document,
): HTMLElement | null {
  return findByExactLabel(root, CONFIRM_MERGE_LABELS);
}
