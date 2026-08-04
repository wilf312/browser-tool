/** The Meet auto join settings: two controls, written straight away. */

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MEET_SETTINGS,
  loadMeetSettings,
  onMeetSettingsChanged,
  saveMeetSettings,
} from '../lib/meet-settings';
import { INTERVAL_CHOICES } from '../lib/meet-schedule';
import type { MeetSettings } from '../lib/types';
import { useStatus } from './useStatus';

export function MeetAutoJoinSection() {
  const [settings, setSettings] = useState<MeetSettings>({ ...DEFAULT_MEET_SETTINGS });
  const [status, showStatus] = useStatus();
  const intervalRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    loadMeetSettings().then(setSettings);

    onMeetSettingsChanged((next) => {
      // Don't move the dropdown out from under the user while it is open.
      if (document.activeElement === intervalRef.current) return;
      setSettings(next);
    });
  }, []);

  async function update(next: MeetSettings) {
    setSettings(next);
    try {
      await saveMeetSettings(next);
      showStatus('保存しました');
    } catch (error) {
      console.error('[browser-tool] failed to save the Meet settings', error);
      showStatus('保存に失敗しました');
    }
  }

  return (
    <section>
      <h2>Meet 自動入室</h2>
      <p className="lead">
        Google Meet
        の待機画面を開いておくと、次の開始時刻になったときに「参加」ボタンを自動でクリックします。
        <br />
        例) 10:07 に待機画面を開く → <code>10:15</code> に入室
      </p>

      <div className="field">
        <label>
          <input
            type="checkbox"
            id="meet-enabled"
            checked={settings.enabled}
            onChange={(event) => update({ ...settings, enabled: event.target.checked })}
          />{' '}
          自動入室を有効にする
        </label>
      </div>

      <div className="field">
        <label htmlFor="meet-interval">開始時刻の間隔</label>
        <select
          id="meet-interval"
          ref={intervalRef}
          value={String(settings.intervalMinutes)}
          onChange={(event) => update({ ...settings, intervalMinutes: Number(event.target.value) })}
        >
          {INTERVAL_CHOICES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} 分
            </option>
          ))}
        </select>
        <span id="meet-status" className="status" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      <p className="note">
        待機画面の右下に入室予定時刻とカウントダウンが表示され、そこからキャンセルできます。
        カメラとマイクの状態は待機画面の設定がそのまま使われます。
      </p>
    </section>
  );
}
