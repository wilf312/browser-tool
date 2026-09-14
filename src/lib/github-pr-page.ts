/**
 * Which GitHub URLs the auto merge runs on.
 *
 * Only a pull request's own page — `https://github.com/{owner}/{repo}/pull/{number}`
 * (and its tabs, e.g. `/files`) — has the merge box this feature watches. The
 * repository root, the pull request list and the like have no merge button and
 * must be left alone.
 */

const PULL_REQUEST_PATH = /^\/[^/]+\/[^/]+\/pull\/\d+(\/.*)?$/;

export function isPullRequestUrl(url: unknown): boolean {
  if (typeof url !== 'string' || !url) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.host.toLowerCase() !== 'github.com') return false;
  return PULL_REQUEST_PATH.test(parsed.pathname);
}
