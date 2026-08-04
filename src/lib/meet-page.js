/**
 * Which Meet URLs the auto join runs on.
 *
 * Only the waiting screen of an actual meeting — `https://meet.google.com/abc-defg-hij`.
 * The landing page, `/new`, the settings pages and the like have no join button
 * and must be left alone.
 */

const MEETING_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;

/** @param {string} url */
export function isMeetingUrl(url) {
  if (typeof url !== 'string' || !url) return false;

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.host.toLowerCase() !== 'meet.google.com') return false;

  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments.length === 1 && MEETING_CODE.test(segments[0]);
}
