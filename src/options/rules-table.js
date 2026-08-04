/**
 * The rules table: one row per redirect rule with
 * [ enabled checkbox | from | to | delete ] columns.
 *
 * Owns its own copy of the rules and reports every mutation through `onChange`,
 * so the page can persist them.
 */

import { createRule } from '../lib/storage.js';

const COLUMN_COUNT = 4;

function buildRow(rule) {
  const row = document.createElement('tr');
  row.dataset.id = rule.id;

  const enabledCell = document.createElement('td');
  enabledCell.className = 'col-enabled';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'rule-enabled';
  checkbox.checked = rule.enabled;
  checkbox.setAttribute('aria-label', '有効');
  enabledCell.append(checkbox);

  const fromCell = document.createElement('td');
  const fromInput = document.createElement('input');
  fromInput.type = 'text';
  fromInput.className = 'rule-from';
  fromInput.value = rule.from;
  fromInput.placeholder = 'a.atlassian.net';
  fromInput.spellcheck = false;
  fromInput.setAttribute('aria-label', 'from');
  fromCell.append(fromInput);

  const toCell = document.createElement('td');
  const toInput = document.createElement('input');
  toInput.type = 'text';
  toInput.className = 'rule-to';
  toInput.value = rule.to;
  toInput.placeholder = 'b.atlassian.net';
  toInput.spellcheck = false;
  toInput.setAttribute('aria-label', 'to');
  toCell.append(toInput);

  const deleteCell = document.createElement('td');
  deleteCell.className = 'col-delete';
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'rule-delete';
  deleteButton.textContent = '削除';
  deleteButton.title = 'この行を削除';
  deleteCell.append(deleteButton);

  row.append(enabledCell, fromCell, toCell, deleteCell);
  return row;
}

function buildEmptyRow() {
  const row = document.createElement('tr');
  const cell = document.createElement('td');
  cell.className = 'empty';
  cell.colSpan = COLUMN_COUNT;
  cell.textContent = 'ルールがありません。「追加」から登録してください。';
  row.append(cell);
  return row;
}

export function createRulesTable({ tbody, addButton, onChange = () => {} }) {
  let rules = [];

  function render() {
    tbody.replaceChildren();
    if (rules.length === 0) {
      tbody.append(buildEmptyRow());
      return;
    }
    for (const rule of rules) tbody.append(buildRow(rule));
  }

  function emitChange() {
    onChange(rules.map((rule) => ({ ...rule })));
  }

  function findRule(target) {
    const row = target.closest('tr[data-id]');
    if (!row) return null;
    return rules.find((rule) => rule.id === row.dataset.id) ?? null;
  }

  tbody.addEventListener('change', (event) => {
    const target = event.target;
    if (!target.classList.contains('rule-enabled')) return;
    const rule = findRule(target);
    if (!rule) return;
    rule.enabled = target.checked;
    emitChange();
  });

  // Mutating state without re-rendering keeps the caret where the user left it.
  tbody.addEventListener('input', (event) => {
    const target = event.target;
    const field = target.classList.contains('rule-from')
      ? 'from'
      : target.classList.contains('rule-to')
        ? 'to'
        : null;
    if (!field) return;
    const rule = findRule(target);
    if (!rule) return;
    rule[field] = target.value;
    emitChange();
  });

  tbody.addEventListener('click', (event) => {
    const target = event.target;
    if (!target.classList.contains('rule-delete')) return;
    const row = target.closest('tr[data-id]');
    if (!row) return;
    rules = rules.filter((rule) => rule.id !== row.dataset.id);
    render();
    emitChange();
  });

  if (addButton) {
    addButton.addEventListener('click', () => {
      rules = [...rules, createRule()];
      render();
      emitChange();
      tbody.querySelector('tr[data-id]:last-child .rule-from')?.focus();
    });
  }

  return {
    setRules(next) {
      rules = (Array.isArray(next) ? next : []).map((rule) => ({ ...rule }));
      render();
    },
    getRules() {
      return rules.map((rule) => ({ ...rule }));
    },
  };
}
