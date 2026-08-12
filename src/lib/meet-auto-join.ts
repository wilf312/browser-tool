/**
 * The auto join state machine.
 *
 * Kept free of timers and of the DOM: the caller drives it by calling `tick()`
 * (once a second from the content script, by hand from the tests) and receives
 * a snapshot it can render.
 */

import { nextSlot, normalizeIntervalMinutes } from './meet-schedule';
import type { AutoJoinSnapshot, AutoJoinState } from './types';

/**
 * How long after the scheduled time we keep looking for the join button.
 * Meet can take a while to build the waiting screen, but clicking `参加` ten
 * minutes into a meeting would be a surprise, so the attempt expires.
 */
export const DEFAULT_JOIN_WINDOW_MS = 2 * 60 * 1000;

/** How much later `postpone()` puts the join. One more minute, as often as asked. */
export const POSTPONE_MS = 60 * 1000;

export interface AutoJoinOptions {
  now?: () => Date;
  intervalMinutes?: number;
  findButton?: () => { click: () => void } | null | undefined;
  joinWindowMs?: number;
  onUpdate?: (snapshot: AutoJoinSnapshot) => void;
}

export interface AutoJoinController {
  /** Advance the machine. Safe to call after it settled — it becomes a no-op. */
  tick(): AutoJoinSnapshot;
  /** The user does not want to be let in automatically after all. */
  cancel(): AutoJoinSnapshot;
  /** Not yet — push the join one minute further out. */
  postpone(): AutoJoinSnapshot;
  getSnapshot(): AutoJoinSnapshot;
}

export function createAutoJoin({
  now = () => new Date(),
  intervalMinutes,
  findButton,
  joinWindowMs = DEFAULT_JOIN_WINDOW_MS,
  onUpdate = () => {},
}: AutoJoinOptions = {}): AutoJoinController {
  const interval = normalizeIntervalMinutes(intervalMinutes);
  let joinAt = nextSlot(now(), interval);
  let state: AutoJoinState = 'waiting';

  function snapshot(): AutoJoinSnapshot {
    return {
      state,
      joinAt: new Date(joinAt.getTime()),
      remainingMs: Math.max(0, joinAt.getTime() - now().getTime()),
    };
  }

  function settle(next: AutoJoinState): AutoJoinSnapshot {
    state = next;
    const current = snapshot();
    onUpdate(current);
    return current;
  }

  return {
    tick() {
      if (state !== 'waiting') return snapshot();

      const current = now();
      if (current.getTime() < joinAt.getTime()) {
        const waiting = snapshot();
        onUpdate(waiting);
        return waiting;
      }

      const button = findButton?.();
      if (button) {
        button.click();
        return settle('joined');
      }

      if (current.getTime() - joinAt.getTime() > joinWindowMs) return settle('missed');

      const waiting = snapshot();
      onUpdate(waiting);
      return waiting;
    },

    cancel() {
      if (state !== 'waiting') return snapshot();
      return settle('cancelled');
    },

    postpone() {
      if (state !== 'waiting') return snapshot();
      // Measured from now once the slot has gone by, so a postpone during the
      // grace period still buys a whole minute instead of landing in the past.
      joinAt = new Date(Math.max(joinAt.getTime(), now().getTime()) + POSTPONE_MS);
      const current = snapshot();
      onUpdate(current);
      return current;
    },

    getSnapshot: snapshot,
  };
}
