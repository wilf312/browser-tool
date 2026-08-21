/**
 * The Meet auto join, as it runs on the page.
 *
 * Shows the countdown panel on the waiting screen of a meeting and clicks the
 * join button once the next slot boundary is reached. Meet is a single page
 * app, so the URL is watched too: moving from the landing page into a meeting
 * (or from one meeting to another) starts a fresh countdown.
 *
 * The page is also watched for Meet's 「このまま待機を続けますか？」 dialog, which
 * drops you out of the lobby when nobody answers it. That watch outlives the
 * countdown panel: the dialog only shows up minutes after the join was asked
 * for.
 */

import { createAutoJoin, type AutoJoinController } from '../lib/meet-auto-join';
import { findJoinButton } from '../lib/meet-join';
import { findKeepWaitingButton } from '../lib/meet-keep-waiting';
import { isMeetingUrl } from '../lib/meet-page';
import { loadMeetSettings, onMeetSettingsChanged } from '../lib/meet-settings';
import type { MeetSettings } from '../lib/types';
import { createPanel, type Panel } from './meet-panel';

const TICK_MS = 1000;
const URL_POLL_MS = 1000;
/** How often the page is checked for the 「待機を続けますか？」 dialog. */
const KEEP_WAITING_POLL_MS = 1000;
/** How long the outcome stays on screen if the user does not click it away. */
const DISMISS_MS = 6000;

export interface StartOptions {
  document?: Document;
  getUrl?: () => string;
  loadSettings?: () => Promise<MeetSettings>;
  onSettingsChanged?: (callback: (settings: MeetSettings) => void) => void;
  findButton?: () => { click: () => void } | null | undefined;
  findKeepWaiting?: () => { click: () => void } | null | undefined;
  now?: () => Date;
  tickMs?: number;
  urlPollMs?: number;
  keepWaitingPollMs?: number;
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
  findKeepWaiting = () => findKeepWaitingButton(document),
  now = () => new Date(),
  tickMs = TICK_MS,
  urlPollMs = URL_POLL_MS,
  keepWaitingPollMs = KEEP_WAITING_POLL_MS,
  dismissMs = DISMISS_MS,
}: StartOptions = {}): Running {
  let settings: MeetSettings | null = null;
  let session: Session | null = null;
  let keepWaitingTimer: ReturnType<typeof setInterval> | null = null;
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

  function startKeepWaiting() {
    if (keepWaitingTimer !== null) return;
    keepWaitingTimer = setInterval(() => findKeepWaiting()?.click(), keepWaitingPollMs);
  }

  function stopKeepWaiting() {
    if (keepWaitingTimer === null) return;
    clearInterval(keepWaitingTimer);
    keepWaitingTimer = null;
  }

  function sync() {
    const wanted = Boolean(settings?.enabled) && isMeetingUrl(getUrl());
    if (wanted && !session) startSession();
    if (!wanted && session) stopSession();
    // Not tied to the session: the dialog turns up long after the panel is gone.
    if (wanted) startKeepWaiting();
    else stopKeepWaiting();
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
      stopKeepWaiting();
      stopSession();
    },
    getSession: () => session,
  };
}
