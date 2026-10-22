/**
 * Telling whether we are already in the call.
 *
 * Meet keeps the same URL from the waiting screen into the call, so only the
 * page can say we are in. The one button that exists in the call and never on
 * the waiting screen is the red hang-up button — 通話から退出 / Leave call — so
 * its presence is the sign.
 *
 * The label is matched as a whole, and buttons inside a dialog are left out:
 * the 「待機を続けますか？」 dialog in the lobby has a 退出 button of its own, and
 * mistaking the lobby for the call would stop the 待機 answers that keep us in it.
 */

import { clickableButtons, exactLabelsOf } from './page-buttons';

/** Matched against the whole label, case insensitively. */
export const LEAVE_CALL_LABELS = ['通話から退出', 'Leave call'];

const DIALOG_SELECTOR = 'dialog, [role="dialog"], [role="alertdialog"]';

/**
 * @param root where to look; defaults to the page.
 * @returns whether the hang-up button is on the page.
 */
export function isInCall(root: ParentNode | null | undefined = globalThis.document): boolean {
  const wanted = new Set(LEAVE_CALL_LABELS.map((label) => label.toLowerCase()));

  return clickableButtons(root).some(
    (element) =>
      !element.closest(DIALOG_SELECTOR) &&
      exactLabelsOf(element).some((label) => wanted.has(label.toLowerCase())),
  );
}
