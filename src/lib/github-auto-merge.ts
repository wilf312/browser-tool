/**
 * The GitHub auto merge state machine.
 *
 * Kept free of timers and of the DOM: the caller drives it by calling `tick()`
 * (on a poll from the content script, by hand from the tests) and receives a
 * snapshot it can render. Turned on, it watches the CI summary and, once every
 * check has passed, clicks through GitHub's own merge button and its commit
 * message confirmation for the caller.
 */

import type { CiStatus } from './github-ci-status';

export type AutoMergeState = 'off' | 'watching' | 'merging' | 'done' | 'failed';

export interface AutoMergeSnapshot {
  state: AutoMergeState;
}

/** How long we keep looking for the commit message confirmation once the merge button is clicked. */
export const DEFAULT_CONFIRM_WINDOW_MS = 15 * 1000;

export interface AutoMergeOptions {
  now?: () => number;
  findCiStatus?: () => CiStatus;
  findMergeButton?: () => { click: () => void } | null | undefined;
  findConfirmButton?: () => { click: () => void } | null | undefined;
  confirmWindowMs?: number;
  onUpdate?: (snapshot: AutoMergeSnapshot) => void;
}

export interface AutoMergeController {
  /** The user turned the watch on. */
  start(): AutoMergeSnapshot;
  /** The user turned the watch off before it merged. */
  stop(): AutoMergeSnapshot;
  /** Advance the machine. Safe to call while off or once settled — a no-op then. */
  tick(): AutoMergeSnapshot;
  getSnapshot(): AutoMergeSnapshot;
}

export function createAutoMerge({
  now = () => Date.now(),
  findCiStatus = () => 'unknown',
  findMergeButton = () => null,
  findConfirmButton = () => null,
  confirmWindowMs = DEFAULT_CONFIRM_WINDOW_MS,
  onUpdate = () => {},
}: AutoMergeOptions = {}): AutoMergeController {
  let state: AutoMergeState = 'off';
  let mergeClickedAt: number | null = null;

  function snapshot(): AutoMergeSnapshot {
    return { state };
  }

  function settle(next: AutoMergeState): AutoMergeSnapshot {
    state = next;
    const current = snapshot();
    onUpdate(current);
    return current;
  }

  return {
    start() {
      if (state !== 'off') return snapshot();
      return settle('watching');
    },

    stop() {
      if (state !== 'watching') return snapshot();
      mergeClickedAt = null;
      return settle('off');
    },

    tick() {
      if (state === 'watching') {
        const status = findCiStatus();
        if (status === 'failure') return settle('failed');
        if (status !== 'success') return snapshot();

        const mergeButton = findMergeButton();
        if (!mergeButton) return settle('done'); // merged elsewhere, or already merged

        mergeButton.click();
        mergeClickedAt = now();
        return settle('merging');
      }

      if (state === 'merging') {
        const confirmButton = findConfirmButton();
        if (confirmButton) {
          confirmButton.click();
          return settle('done');
        }
        if (now() - (mergeClickedAt ?? now()) > confirmWindowMs) return settle('failed');
        return snapshot();
      }

      return snapshot();
    },

    getSnapshot: snapshot,
  };
}
