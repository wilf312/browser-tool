/**
 * The reload timer, driven from the toolbar popup.
 *
 * The tab that was on screen when the popup was opened is the one that gets
 * reloaded, so this section is about one tab at a time: it either offers to
 * start a timer on it or reports the one that is already running. The timer
 * itself lives in an alarm — closing the popup does not stop it, and reopening
 * it picks the countdown back up from the stored job.
 */

import { useCallback, useEffect, useState } from 'react';
import { getActiveTab, type ActiveTab } from '../lib/active-tab';
import { formatCountdown } from '../lib/format-time';
import { t } from '../lib/i18n';
import { loadReloadJob, startReloadJob, stopReloadJob } from '../lib/reload-jobs';
import {
  DEFAULT_RELOAD_SETTINGS,
  loadReloadSettings,
  saveReloadSettings,
} from '../lib/reload-settings';
import {
  formatDurationLabel,
  formatIntervalLabel,
  RELOAD_DURATION_CHOICES,
  RELOAD_INTERVAL_CHOICES,
  reloadProgress,
} from '../lib/reload-timer';
import type { ReloadJob, ReloadSettings } from '../lib/types';
import { useStatus } from './useStatus';

const TICK_MS = 1000;

/**
 * The dropdown values, plus whatever is stored in case it came from a hand
 * edited file — a value with no option would leave the dropdown blank.
 */
function choicesWith(choices: readonly number[], current: number): number[] {
  if (choices.includes(current)) return [...choices];
  const at = choices.findIndex((choice) => choice > current);
  if (at === -1) return [...choices, current];
  return [...choices.slice(0, at), current, ...choices.slice(at)];
}

/** How the tab under the timer is named. Its URL, unless there is none to show. */
function describeTab(tab: ActiveTab): string {
  return tab.url || tab.title || t('reload_tab_fallback');
}

export function ReloadTimerSection() {
  /** `undefined` until the lookup is done, `null` when there is no tab to act on. */
  const [tab, setTab] = useState<ActiveTab | null | undefined>(undefined);
  const [settings, setSettings] = useState<ReloadSettings>({ ...DEFAULT_RELOAD_SETTINGS });
  const [job, setJob] = useState<ReloadJob | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [status, showStatus] = useStatus();

  useEffect(() => {
    loadReloadSettings().then(setSettings);

    getActiveTab().then(async (active) => {
      setTab(active);
      if (active) setJob(await loadReloadJob(active.id));
    });
  }, []);

  // Only while something is counting down: an idle popup has nothing to redraw.
  useEffect(() => {
    if (!job) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNowMs(at);
      if (reloadProgress(job, new Date(at)).done) setJob(null);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [job]);

  const update = useCallback(async (next: ReloadSettings) => {
    setSettings(next);
    try {
      await saveReloadSettings(next);
    } catch (error) {
      console.error('[nanatsudougu] failed to save the reload timer settings', error);
    }
  }, []);

  const handleStart = useCallback(
    async (target: ActiveTab) => {
      try {
        setNowMs(Date.now());
        setJob(await startReloadJob({ tabId: target.id, ...settings }));
        showStatus(t('reload_started'));
      } catch (error) {
        console.error('[nanatsudougu] failed to start the reload timer', error);
        showStatus(t('reload_start_failed'));
      }
    },
    [settings, showStatus],
  );

  const handleStop = useCallback(
    async (target: ActiveTab) => {
      try {
        await stopReloadJob(target.id);
        setJob(null);
        showStatus(t('reload_stopped'));
      } catch (error) {
        console.error('[nanatsudougu] failed to stop the reload timer', error);
        showStatus(t('reload_stop_failed'));
      }
    },
    [showStatus],
  );

  const progress = job === null ? null : reloadProgress(job, new Date(nowMs));
  const running = job !== null && progress !== null && !progress.done;

  return (
    <section>
      <h2>{t('feature_reload_timer')}</h2>
      <p className="lead">
        {t('reload_lead')}
        <br />
        {t('reload_example_prefix')}
        <code>{t('unit_minutes', ['1'])}</code>
        {t('reload_example_between')}
        <code>{t('unit_minutes', ['30'])}</code>
        {t('reload_example_mid')}
        {t('unit_minutes', ['30'])}
        {t('reload_example_suffix')}
      </p>

      {tab === undefined && <p className="status">{t('reload_checking_tab')}</p>}

      {tab === null && <p className="note">{t('reload_no_tab_note')}</p>}

      {tab && (
        <>
          <p className="target">
            {t('reload_target_label')}
            <code>{describeTab(tab)}</code>
          </p>

          {running ? (
            <>
              <p id="reload-progress" className="field" role="status" aria-live="polite">
                {t('reload_progress_lead', [
                  formatIntervalLabel(job.intervalSeconds),
                  formatCountdown(progress.remainingMs),
                ])}
                {progress.nextInMs !== null &&
                  t('reload_progress_next', [formatCountdown(progress.nextInMs)])}
                {t('reload_progress_tail')}
              </p>
              <div className="actions">
                <button type="button" id="reload-stop" onClick={() => void handleStop(tab)}>
                  {t('reload_stop')}
                </button>
                <span className="status" role="status" aria-live="polite">
                  {status}
                </span>
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="reload-interval">{t('reload_interval_label')}</label>
              <select
                id="reload-interval"
                value={String(settings.intervalSeconds)}
                onChange={(event) =>
                  void update({ ...settings, intervalSeconds: Number(event.target.value) })
                }
              >
                {choicesWith(RELOAD_INTERVAL_CHOICES, settings.intervalSeconds).map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {formatIntervalLabel(seconds)}
                  </option>
                ))}
              </select>

              <label htmlFor="reload-duration">{t('reload_duration_label')}</label>
              <select
                id="reload-duration"
                value={String(settings.durationMinutes)}
                onChange={(event) =>
                  void update({ ...settings, durationMinutes: Number(event.target.value) })
                }
              >
                {choicesWith(RELOAD_DURATION_CHOICES, settings.durationMinutes).map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDurationLabel(minutes)}
                  </option>
                ))}
              </select>

              <button type="button" id="reload-start" onClick={() => void handleStart(tab)}>
                {t('reload_start')}
              </button>
              <span className="status" role="status" aria-live="polite">
                {status}
              </span>
            </div>
          )}
        </>
      )}

      <p className="note">{t('reload_footer_note')}</p>
    </section>
  );
}
