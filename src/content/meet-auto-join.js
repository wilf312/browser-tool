/**
 * Content script entry point for the Meet auto join.
 *
 * Runs on the waiting screen of a meeting, shows the countdown panel and clicks
 * the join button once the next slot boundary is reached. Meet is a single page
 * app, so the URL is watched too: moving from the landing page into a meeting
 * (or from one meeting to another) starts a fresh countdown.
 */

import { createAutoJoin } from '../lib/meet-auto-join.js';
import { findJoinButton } from '../lib/meet-join.js';
import { isMeetingUrl } from '../lib/meet-page.js';
import { loadMeetSettings, onMeetSettingsChanged } from '../lib/meet-settings.js';
import { createPanel } from './meet-panel.js';

const TICK_MS = 1000;
const URL_POLL_MS = 1000;
/** How long the outcome stays on screen once the countdown is over. */
const DISMISS_MS = 6000;

export function start({
  document = globalThis.document,
  getUrl = () => globalThis.location?.href ?? '',
  loadSettings = loadMeetSettings,
  onSettingsChanged = onMeetSettingsChanged,
  findButton = () => findJoinButton(document),
  now = () => new Date(),
  tickMs = TICK_MS,
  urlPollMs = URL_POLL_MS,
  dismissMs = DISMISS_MS,
} = {}) {
  let settings = null;
  let session = null;
  let url = getUrl();

  function stopSession() {
    if (!session) return;
    clearInterval(session.tickTimer);
    if (session.dismissTimer !== null) clearTimeout(session.dismissTimer);
    session.panel.destroy();
    session = null;
  }

  function startSession() {
    let controller;

    const panel = createPanel({ document, onCancel: () => controller?.cancel() });

    controller = createAutoJoin({
      now,
      intervalMinutes: settings.intervalMinutes,
      findButton,
      onUpdate: (snapshot) => {
        if (!session) return;
        session.panel.update(snapshot);
        if (snapshot.state === 'waiting' || session.dismissTimer !== null) return;
        // Settled: stop ticking and let the user read the outcome before it goes.
        clearInterval(session.tickTimer);
        session.dismissTimer = setTimeout(stopSession, dismissMs);
      },
    });

    panel.mount();
    session = {
      panel,
      controller,
      tickTimer: setInterval(() => controller.tick(), tickMs),
      dismissTimer: null,
    };
    panel.update(controller.getSnapshot());
  }

  function sync() {
    const wanted = Boolean(settings?.enabled) && isMeetingUrl(getUrl());
    if (wanted && !session) startSession();
    if (!wanted && session) stopSession();
  }

  const urlTimer = setInterval(() => {
    const current = getUrl();
    if (current === url) return;
    url = current;
    stopSession(); // a different meeting deserves its own countdown
    sync();
  }, urlPollMs);

  onSettingsChanged((next) => {
    const changedInterval = settings && settings.intervalMinutes !== next.intervalMinutes;
    settings = next;
    if (changedInterval) stopSession();
    sync();
  });

  const ready = loadSettings().then((loaded) => {
    settings = loaded;
    sync();
  });

  return {
    ready,
    stop() {
      clearInterval(urlTimer);
      stopSession();
    },
    getSession: () => session,
  };
}
