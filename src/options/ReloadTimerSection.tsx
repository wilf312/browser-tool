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
  return tab.url || tab.title || 'このタブ';
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
        showStatus('開始しました');
      } catch (error) {
        console.error('[nanatsudougu] failed to start the reload timer', error);
        showStatus('開始できませんでした');
      }
    },
    [settings, showStatus],
  );

  const handleStop = useCallback(
    async (target: ActiveTab) => {
      try {
        await stopReloadJob(target.id);
        setJob(null);
        showStatus('停止しました');
      } catch (error) {
        console.error('[nanatsudougu] failed to stop the reload timer', error);
        showStatus('停止できませんでした');
      }
    },
    [showStatus],
  );

  const progress = job === null ? null : reloadProgress(job, new Date(nowMs));
  const running = job !== null && progress !== null && !progress.done;

  return (
    <section>
      <h2>ページ自動リロード</h2>
      <p className="lead">
        今開いているタブを、決めた間隔で決めた時間だけリロードし続けます。
        <br />
        例) <code>1 分</code> ごとに <code>30 分</code> 間 → 30 分たったら自動で止まります
      </p>

      {tab === undefined && <p className="status">対象のタブを確認しています…</p>}

      {tab === null && (
        <p className="note">
          対象のタブが見つかりません。リロードしたいページを開いた状態で、ツールバーの Nanatsudougu
          アイコンからこの画面を開いてください。
        </p>
      )}

      {tab && (
        <>
          <p className="target">
            対象: <code>{describeTab(tab)}</code>
          </p>

          {running ? (
            <>
              <p id="reload-progress" className="field" role="status" aria-live="polite">
                {formatIntervalLabel(job.intervalSeconds)} ごとにリロードしています（終了まで{' '}
                {formatCountdown(progress.remainingMs)}
                {progress.nextInMs !== null && ` ／ 次まで ${formatCountdown(progress.nextInMs)}`}）
              </p>
              <div className="actions">
                <button type="button" id="reload-stop" onClick={() => void handleStop(tab)}>
                  停止
                </button>
                <span className="status" role="status" aria-live="polite">
                  {status}
                </span>
              </div>
            </>
          ) : (
            <div className="field">
              <label htmlFor="reload-interval">リロード間隔</label>
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

              <label htmlFor="reload-duration">続ける時間</label>
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
                開始
              </button>
              <span className="status" role="status" aria-live="polite">
                {status}
              </span>
            </div>
          )}
        </>
      )}

      <p className="note">
        タイマーはタブごとに動きます。この画面を閉じても続き、決めた時間がたつか、タブを閉じるか、
        「停止」を押すと終わります。対象はタブなので、そのタブで別のページへ移動したときは移動先が
        リロードされます。
      </p>
    </section>
  );
}
