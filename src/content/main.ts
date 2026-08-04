/**
 * Content script entry point.
 *
 * Manifest v3 injects content scripts as classic scripts, so this file is built
 * into a single self contained bundle (`vite.content.config.ts`) — no dynamic
 * import and no `web_accessible_resources` needed.
 */

import { start } from './meet-auto-join';

try {
  start();
} catch (error) {
  console.error('[browser-tool] failed to start the Meet auto join', error);
}
