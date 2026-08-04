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

export type AutoJoinState = 'waiting' | 'joined' | 'missed' | 'cancelled';

/** What the state machine hands to whoever renders the countdown. */
export interface AutoJoinSnapshot {
  state: AutoJoinState;
  joinAt: Date;
  remainingMs: number;
}
