/**
 * Content script entry point.
 *
 * Manifest v3 injects content scripts as classic scripts, so this file is built
 * into a single self contained bundle (`vite.content.config.ts`) — no dynamic
 * import and no `web_accessible_resources` needed.
 */

import { start } from './meet-auto-join';
import { start as startGithubAutoMerge } from './github-auto-merge';

try {
  start();
} catch (error) {
  console.error('[nanatsudougu] failed to start the Meet auto join', error);
}

try {
  startGithubAutoMerge();
} catch (error) {
  console.error('[nanatsudougu] failed to start the GitHub auto merge', error);
}
