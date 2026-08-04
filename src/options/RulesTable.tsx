/**
 * The rules table: one row per redirect rule with
 * [ enabled checkbox | from | to | delete ] columns.
 *
 * Presentational — the rules and their persistence live in the parent section.
 */

import type { Ref } from 'react';
import type { RedirectRule } from '../lib/types';

const COLUMN_COUNT = 4;

export interface RulesTableProps {
  rules: RedirectRule[];
  /** The row to put the caret in, so a freshly added rule can be typed into right away. */
  focusId?: string | null;
  onChange: (id: string, patch: Partial<Omit<RedirectRule, 'id'>>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  /** Lets the parent tell whether the user is editing a row before it re-renders one. */
  bodyRef?: Ref<HTMLTableSectionElement>;
  status?: string;
}

export function RulesTable({
  rules,
  focusId = null,
  onChange,
  onDelete,
  onAdd,
  bodyRef,
  status = '',
}: RulesTableProps) {
  return (
    <>
      <table>
        <thead>
          <tr>
            <th scope="col" className="col-enabled">
              有効
            </th>
            <th scope="col">from</th>
            <th scope="col">to</th>
            <th scope="col" className="col-delete">
              削除
            </th>
          </tr>
        </thead>
        <tbody id="rules" ref={bodyRef}>
          {rules.length === 0 ? (
            <tr>
              <td className="empty" colSpan={COLUMN_COUNT}>
                ルールがありません。「追加」から登録してください。
              </td>
            </tr>
          ) : (
            rules.map((rule) => (
              <tr key={rule.id} data-id={rule.id}>
                <td className="col-enabled">
                  <input
                    type="checkbox"
                    className="rule-enabled"
                    aria-label="有効"
                    checked={rule.enabled}
                    onChange={(event) => onChange(rule.id, { enabled: event.target.checked })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="rule-from"
                    aria-label="from"
                    placeholder="a.atlassian.net"
                    spellCheck={false}
                    autoFocus={rule.id === focusId}
                    value={rule.from}
                    onChange={(event) => onChange(rule.id, { from: event.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    className="rule-to"
                    aria-label="to"
                    placeholder="b.atlassian.net"
                    spellCheck={false}
                    value={rule.to}
                    onChange={(event) => onChange(rule.id, { to: event.target.value })}
                  />
                </td>
                <td className="col-delete">
                  <button
                    type="button"
                    className="rule-delete"
                    title="この行を削除"
                    onClick={() => onDelete(rule.id)}
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="actions">
        <button type="button" id="add" onClick={onAdd}>
          ＋ 追加
        </button>
        <span id="status" className="status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
    </>
  );
}
