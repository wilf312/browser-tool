/**
 * Export the settings to a JSON file and read one back.
 *
 * Both directions are per feature: the export writes only the ticked features
 * into the file, and the import applies only the ticked ones out of it. The
 * features left out keep whatever is stored.
 */

import { useCallback, useEffect, useState } from 'react';
import { loadMeetSettings, onMeetSettingsChanged, saveMeetSettings } from '../lib/meet-settings';
import {
  loadReloadSettings,
  onReloadSettingsChanged,
  saveReloadSettings,
} from '../lib/reload-settings';
import { loadRules, onRulesChanged, saveRules } from '../lib/storage';
import {
  buildBundle,
  describeFeature,
  exportFilename,
  FEATURE_IDS,
  FEATURE_LABELS,
  featuresInBundle,
  formatExportedAt,
  parseBundle,
  pickFeatures,
  serializeBundle,
  type FeatureId,
  type SettingsBundle,
  type SettingsFeatures,
} from '../lib/settings-transfer';
import { downloadText } from './download';
import { useStatus } from './useStatus';

/** Read the picked features out of storage, right before they are written to the file. */
async function readFeatures(ids: readonly FeatureId[]): Promise<SettingsFeatures> {
  const features: SettingsFeatures = {};
  if (ids.includes('redirectRules')) features.redirectRules = await loadRules();
  if (ids.includes('meetAutoJoin')) features.meetAutoJoin = await loadMeetSettings();
  if (ids.includes('reloadTimer')) features.reloadTimer = await loadReloadSettings();
  return features;
}

/** Write the picked features back. The other sections pick the change up through storage. */
async function writeFeatures(features: SettingsFeatures): Promise<void> {
  if (features.redirectRules !== undefined) await saveRules(features.redirectRules);
  if (features.meetAutoJoin !== undefined) await saveMeetSettings(features.meetAutoJoin);
  if (features.reloadTimer !== undefined) await saveReloadSettings(features.reloadTimer);
}

/** Tick or untick one feature, keeping the list in the order the features are shown. */
function toggle(ids: readonly FeatureId[], id: FeatureId, checked: boolean): FeatureId[] {
  return FEATURE_IDS.filter((current) => (current === id ? checked : ids.includes(current)));
}

export function SettingsTransferSection() {
  /** What is stored right now — only used to say how much each export would carry. */
  const [stored, setStored] = useState<SettingsFeatures>({});
  const [exportIds, setExportIds] = useState<FeatureId[]>([...FEATURE_IDS]);
  /** The file that was read and is waiting for the user to confirm what to apply. */
  const [pending, setPending] = useState<SettingsBundle | null>(null);
  const [importIds, setImportIds] = useState<FeatureId[]>([]);
  const [error, setError] = useState('');
  const [exportStatus, showExportStatus] = useStatus();
  const [importStatus, showImportStatus] = useStatus();

  useEffect(() => {
    loadRules().then((rules) => setStored((current) => ({ ...current, redirectRules: rules })));
    loadMeetSettings().then((meet) => setStored((current) => ({ ...current, meetAutoJoin: meet })));
    loadReloadSettings().then((timer) =>
      setStored((current) => ({ ...current, reloadTimer: timer })),
    );

    onRulesChanged((rules) => setStored((current) => ({ ...current, redirectRules: rules })));
    onMeetSettingsChanged((meet) => setStored((current) => ({ ...current, meetAutoJoin: meet })));
    onReloadSettingsChanged((timer) =>
      setStored((current) => ({ ...current, reloadTimer: timer })),
    );
  }, []);

  const handleExport = useCallback(async () => {
    try {
      const features = await readFeatures(exportIds);
      downloadText(exportFilename(), serializeBundle(buildBundle(features, exportIds)));
      showExportStatus('エクスポートしました');
    } catch (failure) {
      console.error('[nanatsudougu] failed to export the settings', failure);
      showExportStatus('エクスポートに失敗しました');
    }
  }, [exportIds, showExportStatus]);

  const handleFile = useCallback(async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    // Clear the input so picking the same file again after a cancel still fires.
    input.value = '';
    if (!file) return;

    const result = parseBundle(await file.text());
    if (!result.ok) {
      setPending(null);
      setError(result.error);
      return;
    }
    setError('');
    setPending(result.bundle);
    setImportIds(featuresInBundle(result.bundle.features));
  }, []);

  const handleApply = useCallback(
    async (bundle: SettingsBundle) => {
      try {
        await writeFeatures(pickFeatures(bundle.features, importIds));
        setPending(null);
        showImportStatus('インポートしました');
      } catch (failure) {
        console.error('[nanatsudougu] failed to import the settings', failure);
        showImportStatus('インポートに失敗しました');
      }
    },
    [importIds, showImportStatus],
  );

  const handleCancel = useCallback(() => {
    setPending(null);
    setError('');
  }, []);

  return (
    <section>
      <h2>設定のインポート / エクスポート</h2>
      <p className="lead">
        設定を JSON
        ファイルに書き出して、別の端末や再インストールしたあとに読み込めます。書き出す機能も、取り込む機能も選べます。
      </p>

      <h3>エクスポート</h3>
      <fieldset className="feature-picker">
        <legend>書き出す機能</legend>
        {FEATURE_IDS.map((id) => (
          <label key={id} className="feature">
            <input
              type="checkbox"
              aria-label={FEATURE_LABELS[id]}
              checked={exportIds.includes(id)}
              onChange={(event) => setExportIds(toggle(exportIds, id, event.target.checked))}
            />
            <span>{FEATURE_LABELS[id]}</span>
            <span className="feature-detail">{describeFeature(stored, id)}</span>
          </label>
        ))}
      </fieldset>

      <div className="actions">
        <button
          type="button"
          id="export"
          disabled={exportIds.length === 0}
          onClick={() => void handleExport()}
        >
          エクスポート
        </button>
        <span className="status" role="status" aria-live="polite">
          {exportStatus}
        </span>
      </div>

      <h3>インポート</h3>
      <div className="field">
        <label htmlFor="import-file">設定ファイル</label>
        <input
          type="file"
          id="import-file"
          accept="application/json,.json"
          onChange={(event) => void handleFile(event.target)}
        />
        <span className="status" role="status" aria-live="polite">
          {importStatus}
        </span>
      </div>

      {error !== '' && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {pending !== null && (
        <>
          <fieldset className="feature-picker">
            <legend>取り込む機能</legend>
            {featuresInBundle(pending.features).map((id) => (
              <label key={id} className="feature">
                <input
                  type="checkbox"
                  aria-label={FEATURE_LABELS[id]}
                  checked={importIds.includes(id)}
                  onChange={(event) => setImportIds(toggle(importIds, id, event.target.checked))}
                />
                <span>{FEATURE_LABELS[id]}</span>
                <span className="feature-detail">{describeFeature(pending.features, id)}</span>
              </label>
            ))}
          </fieldset>

          <div className="actions">
            <button
              type="button"
              id="import-apply"
              disabled={importIds.length === 0}
              onClick={() => void handleApply(pending)}
            >
              選択した設定を適用
            </button>
            <button type="button" id="import-cancel" onClick={handleCancel}>
              キャンセル
            </button>
          </div>

          {formatExportedAt(pending.exportedAt) !== '' && (
            <p className="note">
              {formatExportedAt(pending.exportedAt)} に書き出されたファイルです。
            </p>
          )}
        </>
      )}

      <p className="note">
        適用すると、選んだ機能の設定は今の内容を置き換えます。選ばなかった機能はそのままです。
      </p>
    </section>
  );
}
