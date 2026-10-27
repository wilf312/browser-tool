/**
 * Which Meet URLs the auto join runs on.
 *
 * Only the waiting screen of an actual meeting — `https://meet.google.com/abc-defg-hij`,
 * or the newer form with a `meet/` prefix, `https://meet.google.com/meet/abc-defg-hij`.
 * The landing page, `/new`, the settings pages and the like have no join button
 * and must be left alone.
 */

const MEETING_CODE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i;

export function isMeetingUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.host.toLowerCase() !== 'meet.google.com') return false;

  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length === 2 && segments[0] === 'meet') segments.shift();
  return segments.length === 1 && MEETING_CODE.test(segments[0]);
}
