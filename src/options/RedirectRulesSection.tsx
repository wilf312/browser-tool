/** The Jira redirect rules: load them, edit them, write them back. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRule, loadRules, onRulesChanged, saveRules } from '../lib/storage';
import { debounce } from '../lib/debounce';
import { t } from '../lib/i18n';
import type { RedirectRule } from '../lib/types';
import { RulesTable } from './RulesTable';
import { useStatus } from './useStatus';

/** `chrome.storage.sync` has a write quota, so typing must not become a write per keystroke. */
const SAVE_DEBOUNCE_MS = 400;

export function RedirectRulesSection() {
  const [rules, setRules] = useState<RedirectRule[]>([]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [status, showStatus] = useStatus();
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  const persist = useMemo(
    () =>
      debounce(async (next: RedirectRule[]) => {
        try {
          await saveRules(next);
          showStatus(t('saved'));
        } catch (error) {
          console.error('[nanatsudougu] failed to save rules', error);
          showStatus(t('save_failed'));
        }
      }, SAVE_DEBOUNCE_MS),
    [showStatus],
  );

  /** Every edit goes through here: render it, then let the debounced write catch up. */
  const update = useCallback(
    (next: RedirectRule[]) => {
      setRules(next);
      persist(next);
    },
    [persist],
  );

  useEffect(() => {
    loadRules().then(setRules);

    // Another context (the options tab, the popup, another device) edited the rules.
    onRulesChanged((next) => {
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

  const handleChange = useCallback(
    (id: string, patch: Partial<Omit<RedirectRule, 'id'>>) => {
      update(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
    },
    [rules, update],
  );

  const handleDelete = useCallback(
    (id: string) => {
      update(rules.filter((rule) => rule.id !== id));
    },
    [rules, update],
  );

  const handleAdd = useCallback(() => {
    const rule = createRule();
    setFocusId(rule.id);
    update([...rules, rule]);
  }, [rules, update]);

  return (
    <section>
      <h2>{t('feature_redirect_rules')}</h2>
      <p className="lead">
        {t('redirect_lead')}
        <br />
        {t('redirect_example_prefix')}
        <code>https://a.atlassian.net/browse/XAPP-134</code>
        {t('redirect_example_arrow')}
        <code>https://b.atlassian.net/browse/XAPP-134</code>
      </p>

      <RulesTable
        rules={rules}
        focusId={focusId}
        status={status}
        bodyRef={tbodyRef}
        onChange={handleChange}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />

      <p className="note">
        {t('redirect_note_prefix')}
        <code>https://</code>
        {t('redirect_note_between')}
        <code>*.atlassian.net</code>
        {t('redirect_note_suffix')}
      </p>
    </section>
  );
}
