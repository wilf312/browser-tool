/**
 * Finding the 待機 button on Meet's "are you still waiting?" dialog.
 *
 * While a meeting has not let you in yet, Meet eventually asks
 * 「まだ通話から退出していません / まだ参加できないようです。このまま待機を続けますか？」
 * with 退出 and 待機. Unanswered, the dialog throws you out of the lobby — so
 * once the auto join has asked to join, the extension answers 待機 for you.
 *
 * The two buttons sit side by side, so the label is matched as a whole: 退出
 * (leaving, the exact opposite) must never be picked by accident.
 */

import { clickableButtons, exactLabelsOf } from './page-buttons';

/** Matched against the whole label, case insensitively. */
export const KEEP_WAITING_LABELS = ['待機', '待機を続ける', 'Keep waiting', 'Wait'];

const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"]';

/**
 * Only buttons inside a dialog are considered: `待機` on its own elsewhere in
 * the Meet UI is none of our business.
 *
 * @param root where to look; defaults to the page.
 * @returns the button to click, or null while the dialog is not up.
 */
export function findKeepWaitingButton(
  root: ParentNode | null | undefined = globalThis.document,
): HTMLElement | null {
  if (!root || typeof root.querySelectorAll !== 'function') return null;

  const wanted = new Set(KEEP_WAITING_LABELS.map((label) => label.toLowerCase()));

  for (const dialog of root.querySelectorAll(DIALOG_SELECTOR)) {
    const match = clickableButtons(dialog).find((element) =>
      exactLabelsOf(element).some((label) => wanted.has(label.toLowerCase())),
    );
    if (match) return match;
  }

  return null;
}
