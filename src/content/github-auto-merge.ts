/**
 * The GitHub auto merge, as it runs on the page.
 *
 * Shows a toggle button right after GitHub's own merge button while checks are
 * still running. Turning it on watches the CI summary and, once every check
 * has passed, clicks through the merge and its commit message confirmation —
 * the same two clicks a person would make by hand.
 *
 * GitHub is a single page app, so the URL is watched too: moving to a
 * different pull request (or away from one) tears down the toggle so the next
 * page starts from a clean slate.
 */

import {
  createAutoMerge,
  type AutoMergeController,
  type AutoMergeSnapshot,
} from '../lib/github-auto-merge';
import { findCiStatus } from '../lib/github-ci-status';
import { findConfirmMergeButton, findMergeButton } from '../lib/github-merge-button';
import { isPullRequestUrl } from '../lib/github-pr-page';
import { createMergeToggle, type MergeToggle } from './github-merge-toggle';

const TICK_MS = 3000;
const URL_POLL_MS = 1000;
/** How long the outcome stays on screen if the checks settle while unwatched. */
const DISMISS_MS = 5000;

export interface StartOptions {
  document?: Document;
  getUrl?: () => string;
  now?: () => number;
  tickMs?: number;
  urlPollMs?: number;
  dismissMs?: number;
}

interface Session {
  toggle: MergeToggle;
  controller: AutoMergeController;
  dismissTimer: ReturnType<typeof setTimeout> | null;
}

export interface Running {
  stop(): void;
  getSession(): Session | null;
}

export function start({
  document = globalThis.document,
  getUrl = () => globalThis.location?.href ?? '',
  now = () => Date.now(),
  tickMs = TICK_MS,
  urlPollMs = URL_POLL_MS,
  dismissMs = DISMISS_MS,
}: StartOptions = {}): Running {
  let session: Session | null = null;
  let url = getUrl();

  function stopSession() {
    if (!session) return;
    if (session.dismissTimer !== null) clearTimeout(session.dismissTimer);
    session.toggle.destroy();
    session = null;
  }

  function startSession(anchor: Element) {
    let controller: AutoMergeController | undefined;

    const toggle = createMergeToggle({
      document,
      anchor,
      onToggle: () => {
        const snap = controller?.getSnapshot();
        if (snap?.state === 'off') controller?.start();
        else if (snap?.state === 'watching') controller?.stop();
      },
    });

    controller = createAutoMerge({
      now,
      findCiStatus: () => findCiStatus(document),
      findMergeButton: () => findMergeButton(document),
      findConfirmButton: () => findConfirmMergeButton(document),
      onUpdate: (snapshot: AutoMergeSnapshot) => {
        if (!session) return;
        session.toggle.update(snapshot);
        if (snapshot.state !== 'done' && snapshot.state !== 'failed') return;
        if (session.dismissTimer !== null) return;
        session.dismissTimer = setTimeout(stopSession, dismissMs);
      },
    });

    toggle.mount();
    session = { toggle, controller, dismissTimer: null };
    toggle.update(controller.getSnapshot());
  }

  function sync() {
    // A settled outcome is left on screen for the caller to read; the dismiss
    // timer, not the next poll, decides when it goes.
    if (session && session.dismissTimer !== null) return;

    if (!isPullRequestUrl(getUrl())) {
      stopSession();
      return;
    }

    const state = session?.controller.getSnapshot().state;
    // While the machine is actively working, `tick()` drives it to a
    // conclusion on its own — GitHub swaps the merge button for the commit
    // message form mid-flight, so re-checking for it here would tear the
    // toggle down right when it matters most.
    if (state === 'watching' || state === 'merging') return;

    const mergeButton = findMergeButton(document);
    const status = findCiStatus(document);

    if (!mergeButton || status !== 'pending') {
      stopSession();
      return;
    }

    if (!session) startSession(mergeButton);
  }

  const tickTimer = setInterval(() => {
    sync();
    session?.controller.tick();
  }, tickMs);

  const urlTimer = setInterval(() => {
    const current = getUrl();
    if (current === url) return;
    url = current;
    stopSession(); // a different pull request deserves its own toggle
    sync();
  }, urlPollMs);

  sync();

  return {
    stop() {
      clearInterval(tickTimer);
      clearInterval(urlTimer);
      stopSession();
    },
    getSession: () => session,
  };
}
