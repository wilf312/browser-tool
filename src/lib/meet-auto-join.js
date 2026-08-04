/**
 * The auto join state machine.
 *
 * Kept free of timers and of the DOM: the caller drives it by calling `tick()`
 * (once a second from the content script, by hand from the tests) and receives
 * a snapshot it can render.
 */

import { nextSlot, normalizeIntervalMinutes } from './meet-schedule.js';

/**
 * How long after the scheduled time we keep looking for the join button.
 * Meet can take a while to build the waiting screen, but clicking `参加` ten
 * minutes into a meeting would be a surprise, so the attempt expires.
 */
export const DEFAULT_JOIN_WINDOW_MS = 2 * 60 * 1000;

/** @typedef {'waiting'|'joined'|'missed'|'cancelled'} AutoJoinState */

export function createAutoJoin({
  now = () => new Date(),
  intervalMinutes,
  findButton,
  joinWindowMs = DEFAULT_JOIN_WINDOW_MS,
  onUpdate = () => {},
} = {}) {
  const interval = normalizeIntervalMinutes(intervalMinutes);
  let joinAt = nextSlot(now(), interval);
  /** @type {AutoJoinState} */
  let state = 'waiting';

  function snapshot() {
    return {
      state,
      joinAt: new Date(joinAt.getTime()),
      remainingMs: Math.max(0, joinAt.getTime() - now().getTime()),
    };
  }

  function settle(next) {
    state = next;
    const current = snapshot();
    onUpdate(current);
    return current;
  }

  return {
    /** Advance the machine. Safe to call after it settled — it becomes a no-op. */
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

    /** The user does not want to be let in automatically after all. */
    cancel() {
      if (state !== 'waiting') return snapshot();
      return settle('cancelled');
    },

    getSnapshot: snapshot,
  };
}
