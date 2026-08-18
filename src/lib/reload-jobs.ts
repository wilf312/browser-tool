/**
 * The running reload timers: one stored job and one alarm per tab.
 *
 * The settings page starts and stops them, the service worker runs them, and
 * neither has to talk to the other — a job in `chrome.storage.session` and an
 * alarm named after its tab is the whole of the handover. Alarms are what makes
 * this survive the worker being shut down between reloads, which it will be:
 * nothing keeps it alive for the minutes (or hours) a timer runs.
 */

import { readSession, writeSession } from './session-storage';
import { createReloadJob, sanitizeReloadJob, shouldReloadNow } from './reload-timer';
import type { ReloadJob } from './types';

export const RELOAD_JOBS_KEY = 'reloadJobs';

const ALARM_PREFIX = 'reload-timer:';

/** The alarm that drives the timer of one tab. */
export function reloadAlarmName(tabId: number): string {
  return `${ALARM_PREFIX}${tabId}`;
}

/** The tab an alarm belongs to, or `null` when the alarm is not one of ours. */
export function tabIdFromAlarmName(name: string): number | null {
  if (!name.startsWith(ALARM_PREFIX)) return null;
  const tabId = Number(name.slice(ALARM_PREFIX.length));
  return Number.isInteger(tabId) ? tabId : null;
}

function alarms(): typeof chrome.alarms | null {
  return globalThis.chrome?.alarms ?? null;
}

function tabs(): typeof chrome.tabs | null {
  return globalThis.chrome?.tabs ?? null;
}

/** Every running job, keyed by tab id. Anything unreadable is dropped. */
export async function loadReloadJobs(): Promise<Record<number, ReloadJob>> {
  const raw = await readSession(RELOAD_JOBS_KEY);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const jobs: Record<number, ReloadJob> = {};
  for (const value of Object.values(raw as Record<string, unknown>)) {
    const job = sanitizeReloadJob(value);
    if (job) jobs[job.tabId] = job;
  }
  return jobs;
}

/** The job of one tab, or `null` when that tab has no timer running. */
export async function loadReloadJob(tabId: number): Promise<ReloadJob | null> {
  return (await loadReloadJobs())[tabId] ?? null;
}

export interface StartReloadJobOptions {
  tabId: number;
  intervalSeconds?: unknown;
  durationMinutes?: unknown;
  now?: Date;
}

/** Start (or restart) the timer of one tab. */
export async function startReloadJob(options: StartReloadJobOptions): Promise<ReloadJob> {
  const job = createReloadJob(options);
  const jobs = await loadReloadJobs();
  await writeSession(RELOAD_JOBS_KEY, { ...jobs, [job.tabId]: job });
  alarms()?.create(reloadAlarmName(job.tabId), {
    when: job.startedAt + job.intervalSeconds * 1000,
    periodInMinutes: job.intervalSeconds / 60,
  });
  return job;
}

/** Stop the timer of one tab. Doing this to a tab that has none is fine. */
export async function stopReloadJob(tabId: number): Promise<void> {
  const jobs = await loadReloadJobs();
  if (tabId in jobs) {
    delete jobs[tabId];
    await writeSession(RELOAD_JOBS_KEY, jobs);
  }
  await alarms()?.clear(reloadAlarmName(tabId));
}

/**
 * One firing of a reload alarm: reload the tab, or clean up once the window is
 * over. A tab that has gone away (or refuses to reload) ends its timer too,
 * which is also how an alarm left over from a previous browser session — the
 * jobs are gone, the alarms are not — puts itself to rest.
 */
export async function runReloadAlarm(alarmName: string, now: Date = new Date()): Promise<void> {
  const tabId = tabIdFromAlarmName(alarmName);
  if (tabId === null) return;

  const job = await loadReloadJob(tabId);
  if (!job || !shouldReloadNow(job, now)) {
    await stopReloadJob(tabId);
    return;
  }

  try {
    await tabs()?.reload(tabId);
  } catch {
    await stopReloadJob(tabId);
  }
}
