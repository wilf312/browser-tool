/** The shapes shared by the storage layer, the UI and the content script. */

/** One redirect rule: `from` and `to` are hosts such as `a.atlassian.net`. */
export interface RedirectRule {
  id: string;
  from: string;
  to: string;
  enabled: boolean;
}

/** The Meet auto join settings. */
export interface MeetSettings {
  enabled: boolean;
  intervalMinutes: number;
}

/** The values the reload timer starts with — remembered between openings. */
export interface ReloadSettings {
  intervalSeconds: number;
  durationMinutes: number;
}

/** One tab being reloaded on a timer. The times are epoch milliseconds. */
export interface ReloadJob {
  tabId: number;
  intervalSeconds: number;
  /** When the timer was started; every reload lands on a multiple of the interval from here. */
  startedAt: number;
  /** When the reloading stops. */
  endsAt: number;
}

/** What the reload timer looks like right now, for whoever renders it. */
export interface ReloadProgress {
  /** Until the timer is done. `0` once it is. */
  remainingMs: number;
  /** Until the next reload, or `null` when no further reload fits in the window. */
  nextInMs: number | null;
  done: boolean;
}

export type AutoJoinState = 'waiting' | 'joined' | 'missed' | 'cancelled';

/** What the state machine hands to whoever renders the countdown. */
export interface AutoJoinSnapshot {
  state: AutoJoinState;
  joinAt: Date;
  remainingMs: number;
}
