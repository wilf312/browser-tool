/** The Meet auto join settings: two controls, written straight away. */

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_MEET_SETTINGS,
  loadMeetSettings,
  onMeetSettingsChanged,
  saveMeetSettings,
} from '../lib/meet-settings';
import { INTERVAL_CHOICES } from '../lib/meet-schedule';
import { t } from '../lib/i18n';
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
      showStatus(t('saved'));
    } catch (error) {
      console.error('[nanatsudougu] failed to save the Meet settings', error);
      showStatus(t('save_failed'));
    }
  }

  return (
    <section>
      <h2>{t('feature_meet_auto_join')}</h2>
      <p className="lead">
        {t('meet_lead')}
        <br />
        {t('meet_example_prefix')}
        <code>10:15</code>
        {t('meet_example_suffix')}
      </p>

      <div className="field">
        <label>
          <input
            type="checkbox"
            id="meet-enabled"
            checked={settings.enabled}
            onChange={(event) => update({ ...settings, enabled: event.target.checked })}
          />{' '}
          {t('meet_enable')}
        </label>
      </div>

      <div className="field">
        <label htmlFor="meet-interval">{t('meet_interval')}</label>
        <select
          id="meet-interval"
          ref={intervalRef}
          value={String(settings.intervalMinutes)}
          onChange={(event) => update({ ...settings, intervalMinutes: Number(event.target.value) })}
        >
          {INTERVAL_CHOICES.map((minutes) => (
            <option key={minutes} value={minutes}>
              {t('unit_minutes', [String(minutes)])}
            </option>
          ))}
        </select>
        <span id="meet-status" className="status" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      <p className="note">{t('meet_note')}</p>
    </section>
  );
}
