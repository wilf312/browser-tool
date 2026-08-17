/**
 * When a tab gets reloaded, and for how long.
 *
 * A job is described by three numbers — the start, the interval and the end —
 * so every reload lands on `startedAt + n × interval` and nothing has to be
 * counted or stored as it goes. The alarm in the service worker and the
 * countdown in the settings page both derive what they need from here, which is
 * why this module has neither timers nor storage in it.
 */

import type { ReloadJob, ReloadProgress } from './types';

/** Chrome does not run an alarm more often than every 30 seconds. */
export const MIN_RELOAD_INTERVAL_SECONDS = 30;
export const MAX_RELOAD_INTERVAL_SECONDS = 60 * 60;

export const MIN_RELOAD_DURATION_MINUTES = 1;
export const MAX_RELOAD_DURATION_MINUTES = 24 * 60;

/** Allowed values in the dropdowns; any other input falls back to the default. */
export const RELOAD_INTERVAL_CHOICES = [30, 60, 180, 300, 600, 1800] as const;
export const RELOAD_DURATION_CHOICES = [5, 15, 30, 60, 180, 480] as const;

export const DEFAULT_RELOAD_INTERVAL_SECONDS = 60;
export const DEFAULT_RELOAD_DURATION_MINUTES = 30;

/**
 * How late an alarm may be and still count as the boundary it was meant for.
 * Without it the reload that falls exactly on the end of the window is lost to
 * a few milliseconds of scheduling jitter.
 */
export const RELOAD_GRACE_MS = 5_000;

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number) || number < min) return fallback;
  return Math.min(number, max);
}

/** Coerce stored / picked input into a usable interval in seconds. */
export function normalizeIntervalSeconds(value: unknown): number {
  return clamp(
    value,
    MIN_RELOAD_INTERVAL_SECONDS,
    MAX_RELOAD_INTERVAL_SECONDS,
    DEFAULT_RELOAD_INTERVAL_SECONDS,
  );
}

/** Coerce stored / picked input into a usable duration in minutes. */
export function normalizeDurationMinutes(value: unknown): number {
  return clamp(
    value,
    MIN_RELOAD_DURATION_MINUTES,
    MAX_RELOAD_DURATION_MINUTES,
    DEFAULT_RELOAD_DURATION_MINUTES,
  );
}

export interface CreateReloadJobOptions {
  tabId: number;
  intervalSeconds?: unknown;
  durationMinutes?: unknown;
  now?: Date;
}

/** Build the job that the timer runs from. */
export function createReloadJob({
  tabId,
  intervalSeconds,
  durationMinutes,
  now = new Date(),
}: CreateReloadJobOptions): ReloadJob {
  const interval = normalizeIntervalSeconds(intervalSeconds);
  const duration = normalizeDurationMinutes(durationMinutes);
  const startedAt = now.getTime();
  return {
    tabId,
    intervalSeconds: interval,
    startedAt,
    endsAt: startedAt + duration * 60_000,
  };
}

/** Coerce anything read from storage into a well formed job, or `null` if it is not one. */
export function sanitizeReloadJob(raw: unknown): ReloadJob | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const job = raw as Partial<ReloadJob>;
  if (!Number.isInteger(job.tabId)) return null;
  if (!Number.isFinite(job.startedAt) || !Number.isFinite(job.endsAt)) return null;
  const startedAt = Number(job.startedAt);
  const endsAt = Number(job.endsAt);
  if (endsAt <= startedAt) return null;
  return {
    tabId: Number(job.tabId),
    intervalSeconds: normalizeIntervalSeconds(job.intervalSeconds),
    startedAt,
    endsAt,
  };
}

/** The first reload boundary strictly after `now`, whether or not it still fits in the window. */
export function nextReloadAt(job: ReloadJob, now: Date): number {
  const intervalMs = job.intervalSeconds * 1000;
  const elapsed = Math.max(0, now.getTime() - job.startedAt);
  return job.startedAt + (Math.floor(elapsed / intervalMs) + 1) * intervalMs;
}

/** Whether an alarm that fired now should still reload, or the job is over. */
export function shouldReloadNow(job: ReloadJob, now: Date): boolean {
  return now.getTime() <= job.endsAt + RELOAD_GRACE_MS;
}

/** Everything the countdown in the settings page needs. */
export function reloadProgress(job: ReloadJob, now: Date): ReloadProgress {
  const remainingMs = Math.max(0, job.endsAt - now.getTime());
  const done = remainingMs === 0;
  const next = nextReloadAt(job, now);
  return {
    remainingMs,
    nextInMs: done || next > job.endsAt + RELOAD_GRACE_MS ? null : next - now.getTime(),
    done,
  };
}

/** `30 秒` / `1 分` / `30 分` — an interval as shown in the dropdown. */
export function formatIntervalLabel(seconds: number): string {
  return seconds < 60 ? `${seconds} 秒` : `${Math.round(seconds / 60)} 分`;
}

/** `30 分` / `1 時間` / `1 時間 30 分` — a duration as shown in the dropdown. */
export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} 分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`;
}
