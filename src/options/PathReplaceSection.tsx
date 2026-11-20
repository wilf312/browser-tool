/**
 * The path replace rules: one row per rule with
 * [ target | replace | with | mode | access | delete ] columns.
 *
 * Each rule only runs on a site the user granted, so every row also shows
 * whether its site is allowed and offers to ask for it.
 */

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from '../lib/debounce';
import {
  hasHostPermission,
  onHostPermissionsChanged,
  requestHostPermission,
} from '../lib/host-permission';
import { t, type MessageKey } from '../lib/i18n';
import { PATH_REPLACE_MODES, pathReplaceRuleProblem, permissionOrigin } from '../lib/path-replace';
import {
  createPathReplaceRule,
  loadPathReplaceRules,
  onPathReplaceRulesChanged,
  savePathReplaceRules,
} from '../lib/path-replace-storage';
import type { PathReplaceMode, PathReplaceRule } from '../lib/types';
import { useStatus } from './useStatus';

/** `chrome.storage.sync` has a write quota, so typing must not become a write per keystroke. */
const SAVE_DEBOUNCE_MS = 400;

const COLUMN_COUNT = 6;

const MODE_LABELS: Record<PathReplaceMode, MessageKey> = {
  always: 'path_replace_mode_always',
  confirm: 'path_replace_mode_confirm',
  disabled: 'path_replace_mode_disabled',
};

/** Which of the rules' sites are granted, keyed by match pattern. */
function useGrantedOrigins(rules: PathReplaceRule[]) {
  const origins = useMemo(
    () => [...new Set(rules.map((rule) => permissionOrigin(rule.pattern)).filter(Boolean))],
    [rules],
  ) as string[];
  const [granted, setGranted] = useState<Record<string, boolean>>({});

  // Read the grants again whenever the sites change, or a grant is given or
  // taken back elsewhere (chrome://extensions, another settings tab).
  useEffect(() => {
    let current = true;
    const refresh = () => {
      Promise.all(
        origins.map(async (origin) => [origin, await hasHostPermission(origin)] as const),
      ).then((entries) => {
        if (current) setGranted(Object.fromEntries(entries));
      });
    };
    refresh();
    const unsubscribe = onHostPermissionsChanged(refresh);
    return () => {
      current = false;
      unsubscribe();
    };
  }, [origins]);

  const request = useCallback(async (origin: string) => {
    try {
      const ok = await requestHostPermission(origin);
      setGranted((value) => ({ ...value, [origin]: ok }));
    } catch (error) {
      console.error('[nanatsudougu] failed to request the host permission', error);
    }
  }, []);

  return { granted, request };
}

export function PathReplaceSection() {
  const [rules, setRules] = useState<PathReplaceRule[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [status, showStatus] = useStatus();
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const { granted, request } = useGrantedOrigins(rules);

  const persist = useMemo(
    () =>
      debounce(async (next: PathReplaceRule[]) => {
        try {
          await savePathReplaceRules(next);
          showStatus(t('saved'));
        } catch (error) {
          console.error('[nanatsudougu] failed to save the path replace rules', error);
          showStatus(t('save_failed'));
        }
      }, SAVE_DEBOUNCE_MS),
    [showStatus],
  );

  const update = useCallback(
    (next: PathReplaceRule[]) => {
      setRules(next);
      persist(next);
    },
    [persist],
  );

  useEffect(() => {
    loadPathReplaceRules().then(setRules);
    onPathReplaceRulesChanged((next) => {
      // Don't clobber a row the user is in the middle of editing.
      if (tbodyRef.current?.contains(document.activeElement)) return;
      setRules(next);
    });
  }, []);

  // A pending save must not be lost when the popup closes.
  useEffect(() => {
    const flush = () => persist.flush();
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [persist]);

  const change = (id: string, patch: Partial<Omit<PathReplaceRule, 'id'>>) => {
    update(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const remove = (id: string) => update(rules.filter((rule) => rule.id !== id));

  const add = () => {
    const rule = createPathReplaceRule();
    setFocusId(rule.id);
    update([...rules, rule]);
  };

  return (
    <section>
      <h2>{t('feature_path_replace')}</h2>
      <p className="lead">
        {t('path_replace_lead')}
        <br />
        {t('redirect_example_prefix')}
        <code>example.com/docs/*</code> : <code>old</code>
        {t('redirect_example_arrow')}
        <code>new</code>
        <br />
        <code>https://example.com/docs/old/a?q=1</code>
        {t('redirect_example_arrow')}
        <code>https://example.com/docs/new/a?q=1</code>
      </p>

      <table className="path-replace">
        <thead>
          <tr>
            <th scope="col">{t('path_replace_col_pattern')}</th>
            <th scope="col" className="col-text">
              {t('path_replace_col_from')}
            </th>
            <th scope="col" className="col-text">
              {t('path_replace_col_to')}
            </th>
            <th scope="col" className="col-mode">
              {t('path_replace_col_mode')}
            </th>
            <th scope="col" className="col-permission">
              {t('path_replace_col_permission')}
            </th>
            <th scope="col" className="col-delete">
              {t('delete')}
            </th>
          </tr>
        </thead>
        <tbody id="path-replace-rules" ref={tbodyRef}>
          {rules.length === 0 ? (
            <tr>
              <td className="empty" colSpan={COLUMN_COUNT}>
                {t('rules_empty')}
              </td>
            </tr>
          ) : (
            rules.map((rule) => {
              const origin = permissionOrigin(rule.pattern);
              const problem = pathReplaceRuleProblem(rule);
              return (
                <Fragment key={rule.id}>
                  <tr data-id={rule.id} className={problem ? 'has-problem' : undefined}>
                    <td>
                      <input
                        type="text"
                        className="path-replace-pattern"
                        aria-label={t('path_replace_col_pattern')}
                        placeholder="*.example.com/docs/*"
                        spellCheck={false}
                        autoFocus={rule.id === focusId}
                        value={rule.pattern}
                        onChange={(event) => change(rule.id, { pattern: event.target.value })}
                      />
                    </td>
                    <td className="col-text">
                      <input
                        type="text"
                        className="path-replace-from"
                        aria-label={t('path_replace_col_from')}
                        placeholder="old"
                        spellCheck={false}
                        value={rule.from}
                        onChange={(event) => change(rule.id, { from: event.target.value })}
                      />
                    </td>
                    <td className="col-text">
                      <input
                        type="text"
                        className="path-replace-to"
                        aria-label={t('path_replace_col_to')}
                        placeholder="new"
                        spellCheck={false}
                        value={rule.to}
                        onChange={(event) => change(rule.id, { to: event.target.value })}
                      />
                    </td>
                    <td className="col-mode">
                      <select
                        className="path-replace-mode"
                        aria-label={t('path_replace_col_mode')}
                        value={rule.mode}
                        onChange={(event) =>
                          change(rule.id, { mode: event.target.value as PathReplaceMode })
                        }
                      >
                        {PATH_REPLACE_MODES.map((mode) => (
                          <option key={mode} value={mode}>
                            {t(MODE_LABELS[mode])}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="col-permission">
                      {origin === null ? null : granted[origin] ? (
                        <span className="status">{t('path_replace_allowed')}</span>
                      ) : (
                        <button
                          type="button"
                          className="path-replace-allow"
                          title={t('path_replace_allow_title', [origin])}
                          onClick={() => request(origin)}
                        >
                          {t('path_replace_allow')}
                        </button>
                      )}
                    </td>
                    <td className="col-delete">
                      <button
                        type="button"
                        className="rule-delete"
                        title={t('delete_row')}
                        onClick={() => remove(rule.id)}
                      >
                        {t('delete')}
                      </button>
                    </td>
                  </tr>
                  {problem === 'loops' ? (
                    <tr className="problem">
                      <td colSpan={COLUMN_COUNT}>
                        <p className="error" role="alert">
                          {t('path_replace_problem_loops')}
                        </p>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" id="path-replace-add" onClick={add}>
          {t('add')}
        </button>
        <span className="status" role="status" aria-live="polite">
          {status}
        </span>
      </div>

      <p className="note">{t('path_replace_note')}</p>
    </section>
  );
}
