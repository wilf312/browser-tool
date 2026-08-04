/**
 * Finding the join button on the Google Meet waiting screen.
 *
 * The button is not there when the page loads (Meet builds it once the devices
 * are ready) and its label depends on the language and on whether the meeting
 * has to let you in, so it is matched by its visible text.
 */

/** Matched as a substring, most specific first. */
export const JOIN_LABELS = [
  '今すぐ参加',
  'Join now',
  '参加をリクエスト',
  'Ask to join',
];

/**
 * Matched only against the whole label: a substring match on `参加` would also
 * hit `参加者` (the participants button).
 */
export const EXACT_JOIN_LABELS = ['参加', 'Join'];

function label(element) {
  const aria = element.getAttribute('aria-label');
  const text = element.textContent ?? '';
  return `${aria ?? ''} ${text}`.replace(/\s+/g, ' ').trim();
}

function exactLabels(element) {
  const aria = element.getAttribute('aria-label');
  const text = element.textContent ?? '';
  return [aria, text].filter((value) => typeof value === 'string').map((value) => value.replace(/\s+/g, ' ').trim());
}

function isClickable(element) {
  if (element.disabled) return false;
  if (element.hidden) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.closest('[aria-hidden="true"]')) return false;
  return true;
}

/**
 * @param {ParentNode} [root]
 * @returns {HTMLElement|null} the button to click, or null while it is not on the page yet.
 */
export function findJoinButton(root = globalThis.document) {
  if (!root || typeof root.querySelectorAll !== 'function') return null;

  const candidates = Array.from(root.querySelectorAll('button, [role="button"]')).filter(isClickable);

  for (const wanted of JOIN_LABELS) {
    const match = candidates.find((element) => label(element).includes(wanted));
    if (match) return match;
  }

  for (const wanted of EXACT_JOIN_LABELS) {
    const match = candidates.find((element) => exactLabels(element).includes(wanted));
    if (match) return match;
  }

  return null;
}
