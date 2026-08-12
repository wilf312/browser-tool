/**
 * The Meet auto join, as it runs on the page.
 *
 * Shows the countdown panel on the waiting screen of a meeting and clicks the
 * join button once the next slot boundary is reached. Meet is a single page
 * app, so the URL is watched too: moving from the landing page into a meeting
 * (or from one meeting to another) starts a fresh countdown.
 */

import { createAutoJoin, type AutoJoinController } from '../lib/meet-auto-join';
import { findJoinButton } from '../lib/meet-join';
import { isMeetingUrl } from '../lib/meet-page';
import { loadMeetSettings, onMeetSettingsChanged } from '../lib/meet-settings';
import type { MeetSettings } from '../lib/types';
import { createPanel, type Panel } from './meet-panel';

const TICK_MS = 1000;
const URL_POLL_MS = 1000;
/** How long the outcome stays on screen if the user does not click it away. */
const DISMISS_MS = 6000;

export interface StartOptions {
  document?: Document;
  getUrl?: () => string;
  loadSettings?: () => Promise<MeetSettings>;
  onSettingsChanged?: (callback: (settings: MeetSettings) => void) => void;
  findButton?: () => { click: () => void } | null | undefined;
  now?: () => Date;
  tickMs?: number;
  urlPollMs?: number;
  dismissMs?: number;
}

interface Session {
  panel: Panel;
  controller: AutoJoinController;
  tickTimer: ReturnType<typeof setInterval>;
  dismissTimer: ReturnType<typeof setTimeout> | null;
}

export interface Running {
  /** Resolves once the stored settings have been applied. */
  ready: Promise<void>;
  stop(): void;
  getSession(): Session | null;
}

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
}: StartOptions = {}): Running {
  let settings: MeetSettings | null = null;
  let session: Session | null = null;
  let url = getUrl();

  function stopSession() {
    if (!session) return;
    clearInterval(session.tickTimer);
    if (session.dismissTimer !== null) clearTimeout(session.dismissTimer);
    session.panel.destroy();
    session = null;
  }

  function startSession() {
    let controller: AutoJoinController | undefined;

    const panel = createPanel({
      document,
      onCancel: () => controller?.cancel(),
      onPostpone: () => controller?.postpone(),
      onHasten: () => controller?.hasten(),
      // The outcome is only shown to be read; clicking it away skips the wait.
      onDismiss: () => stopSession(),
    });

    controller = createAutoJoin({
      now,
      intervalMinutes: settings?.intervalMinutes,
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
      tickTimer: setInterval(() => controller?.tick(), tickMs),
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
    const changedInterval = settings !== null && settings.intervalMinutes !== next.intervalMinutes;
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
