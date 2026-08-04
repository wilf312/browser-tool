// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRulesTable } from '../src/options/rules-table.js';

let tbody;
let addButton;
let onChange;
let table;

function setup(rules = []) {
  document.body.innerHTML = `
    <table><tbody id="rules"></tbody></table>
    <button id="add"></button>
  `;
  tbody = document.getElementById('rules');
  addButton = document.getElementById('add');
  onChange = vi.fn();
  table = createRulesTable({ tbody, addButton, onChange });
  table.setRules(rules);
}

const sample = [
  { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
  { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: false },
];

beforeEach(() => setup(sample));

describe('rendering', () => {
  it('renders one row per rule', () => {
    expect(tbody.querySelectorAll('tr[data-id]')).toHaveLength(2);
  });

  it('renders the checkbox, from, to and delete columns', () => {
    const row = tbody.querySelector('tr[data-id="1"]');
    expect(row.querySelector('.rule-enabled')).toBeTruthy();
    expect(row.querySelector('.rule-from')).toBeTruthy();
    expect(row.querySelector('.rule-to')).toBeTruthy();
    expect(row.querySelector('.rule-delete')).toBeTruthy();
    expect(row.querySelectorAll('td')).toHaveLength(4);
  });

  it('fills the inputs from the rule', () => {
    const row = tbody.querySelector('tr[data-id="1"]');
    expect(row.querySelector('.rule-enabled').checked).toBe(true);
    expect(row.querySelector('.rule-from').value).toBe('a.atlassian.net');
    expect(row.querySelector('.rule-to').value).toBe('b.atlassian.net');
  });

  it('reflects a disabled rule in its checkbox', () => {
    expect(tbody.querySelector('tr[data-id="2"] .rule-enabled').checked).toBe(false);
  });

  it('shows an empty state row when there are no rules', () => {
    setup([]);
    expect(tbody.querySelectorAll('tr[data-id]')).toHaveLength(0);
    expect(tbody.querySelector('.empty')).toBeTruthy();
  });

  it('replaces the rows on a re-render instead of appending', () => {
    table.setRules([sample[0]]);
    expect(tbody.querySelectorAll('tr[data-id]')).toHaveLength(1);
  });

  it('does not report a change while rendering', () => {
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('toggling a rule', () => {
  it('flips enabled and reports the change', () => {
    const checkbox = tbody.querySelector('tr[data-id="1"] .rule-enabled');
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));

    expect(table.getRules()[0].enabled).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0][0].enabled).toBe(false);
  });

  it('enables a disabled rule', () => {
    const checkbox = tbody.querySelector('tr[data-id="2"] .rule-enabled');
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(table.getRules()[1].enabled).toBe(true);
  });
});

describe('editing the hosts', () => {
  it('updates from and reports the change', () => {
    const input = tbody.querySelector('tr[data-id="1"] .rule-from');
    input.value = 'old.atlassian.net';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(table.getRules()[0].from).toBe('old.atlassian.net');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('updates to and reports the change', () => {
    const input = tbody.querySelector('tr[data-id="2"] .rule-to');
    input.value = 'new.atlassian.net';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    expect(table.getRules()[1].to).toBe('new.atlassian.net');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps the focused input alive, so typing is not interrupted', () => {
    const input = tbody.querySelector('tr[data-id="1"] .rule-from');
    input.focus();
    input.value = 'x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.activeElement).toBe(input);
  });
});

describe('deleting a rule', () => {
  it('removes the row and reports the remaining rules', () => {
    tbody.querySelector('tr[data-id="1"] .rule-delete').click();

    expect(table.getRules()).toHaveLength(1);
    expect(table.getRules()[0].id).toBe('2');
    expect(tbody.querySelector('tr[data-id="1"]')).toBeNull();
    expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ id: '2' })]);
  });

  it('shows the empty state once the last rule is deleted', () => {
    tbody.querySelector('tr[data-id="1"] .rule-delete').click();
    tbody.querySelector('tr[data-id="2"] .rule-delete').click();
    expect(table.getRules()).toEqual([]);
    expect(tbody.querySelector('.empty')).toBeTruthy();
  });
});

describe('adding a rule', () => {
  it('appends an empty enabled row and reports the change', () => {
    addButton.click();

    const rules = table.getRules();
    expect(rules).toHaveLength(3);
    expect(rules[2]).toMatchObject({ from: '', to: '', enabled: true });
    expect(tbody.querySelectorAll('tr[data-id]')).toHaveLength(3);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('focuses the from input of the new row', () => {
    addButton.click();
    const rows = tbody.querySelectorAll('tr[data-id]');
    expect(document.activeElement).toBe(rows[2].querySelector('.rule-from'));
  });

  it('works from the empty state', () => {
    setup([]);
    addButton.click();
    expect(table.getRules()).toHaveLength(1);
    expect(tbody.querySelector('.empty')).toBeNull();
  });
});

describe('state isolation', () => {
  it('does not mutate the rules handed to setRules', () => {
    const original = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }];
    table.setRules(original);
    tbody.querySelector('tr[data-id="1"] .rule-delete').click();
    expect(original).toHaveLength(1);
  });
});
