/**
 * Finding the join button on the Google Meet waiting screen.
 *
 * The button is not there when the page loads (Meet builds it once the devices
 * are ready) and its label depends on the language and on whether the meeting
 * has to let you in, so it is matched by its visible text.
 */

import { clickableButtons, exactLabelsOf, labelOf } from './page-buttons';

/**
 * Matched as a substring, most specific first: joining outright in every
 * language before requesting to join in any of them. Japanese and English, then
 * the other locales the extension ships (de / es / zh_CN). Spanish Meet words
 * the same button in more than one way, so it gets every wording seen.
 */
export const JOIN_LABELS = [
  '今すぐ参加',
  'Join now',
  'Jetzt teilnehmen',
  'Unirse ahora',
  'Unirme ahora',
  '立即加入',
  '参加をリクエスト',
  'Ask to join',
  'Teilnahme erbitten',
  'Solicitar unirte',
  'Pedir para unirte',
  '申请加入',
];

/**
 * Matched only against the whole label: a substring match on `参加` would also
 * hit `参加者` (the participants button).
 */
export const EXACT_JOIN_LABELS = ['参加', 'Join'];

/**
 * @param root where to look; defaults to the page.
 * @returns the button to click, or null while it is not on the page yet.
 */
export function findJoinButton(
  root: ParentNode | null | undefined = globalThis.document,
): HTMLElement | null {
  const candidates = clickableButtons(root);

  for (const wanted of JOIN_LABELS) {
    const match = candidates.find((element) => labelOf(element).includes(wanted));
    if (match) return match;
  }

  for (const wanted of EXACT_JOIN_LABELS) {
    const match = candidates.find((element) => exactLabelsOf(element).includes(wanted));
    if (match) return match;
  }

  return null;
}
