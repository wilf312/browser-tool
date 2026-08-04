/**
 * When the auto join fires.
 *
 * Meetings start on the clock: at :00, :15, :30, :45 for the default 15 minute
 * interval. Opening the waiting screen at 10:07 therefore schedules the join
 * for 10:15 — always the next boundary, never the one that already passed.
 */

export const DEFAULT_INTERVAL_MINUTES = 15;

/** Allowed values in the settings dropdown; any other input falls back to the default. */
export const INTERVAL_CHOICES = [5, 10, 15, 30, 60] as const;

/** Coerce stored / typed input into a usable interval in minutes. */
export function normalizeIntervalMinutes(value: unknown): number {
  const minutes = Math.floor(Number(value));
  if (!Number.isFinite(minutes) || minutes < 1) return DEFAULT_INTERVAL_MINUTES;
  return Math.min(minutes, 60);
}

/** The first slot boundary strictly after `now`. */
export function nextSlot(now: Date, intervalMinutes: number = DEFAULT_INTERVAL_MINUTES): Date {
  const interval = normalizeIntervalMinutes(intervalMinutes);
  const slot = new Date(now.getTime());
  slot.setSeconds(0, 0);
  // setMinutes rolls into the next hour (and day) on its own, so 45 + 15 → :00.
  slot.setMinutes((Math.floor(slot.getMinutes() / interval) + 1) * interval);
  return slot;
}

/** `10:05` — the join time as shown to the user. */
export function formatClock(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** `03:42`, or `1:02:03` once an hour is left. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
