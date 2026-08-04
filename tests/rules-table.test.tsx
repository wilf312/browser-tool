import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { RulesTable } from '../src/options/RulesTable';
import type { RedirectRule } from '../src/lib/types';

const sample: RedirectRule[] = [
  { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
  { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: false },
];

let onChange: Mock<(id: string, patch: Partial<Omit<RedirectRule, 'id'>>) => void>;
let onDelete: Mock<(id: string) => void>;
let onAdd: Mock<() => void>;

function setup(rules: RedirectRule[] = sample, focusId: string | null = null) {
  return render(
    <RulesTable
      rules={rules}
      focusId={focusId}
      onChange={onChange}
      onDelete={onDelete}
      onAdd={onAdd}
    />,
  );
}

/** The row rendered for `id`, so the assertions read like the table does. */
function row(id: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`tr[data-id="${id}"]`);
  if (!found) throw new Error(`no row for rule ${id}`);
  return found;
}

beforeEach(() => {
  onChange = vi.fn<(id: string, patch: Partial<Omit<RedirectRule, 'id'>>) => void>();
  onDelete = vi.fn<(id: string) => void>();
  onAdd = vi.fn<() => void>();
});

describe('rendering', () => {
  it('renders one row per rule', () => {
    setup();
    expect(document.querySelectorAll('tr[data-id]')).toHaveLength(2);
  });

  it('renders the checkbox, from, to and delete columns', () => {
    setup();
    const first = within(row('1'));
    expect(first.getByLabelText('有効')).toBeTruthy();
    expect(first.getByLabelText('from')).toBeTruthy();
    expect(first.getByLabelText('to')).toBeTruthy();
    expect(first.getByRole('button', { name: '削除' })).toBeTruthy();
    expect(row('1').querySelectorAll('td')).toHaveLength(4);
  });

  it('fills the inputs from the rule', () => {
    setup();
    const first = within(row('1'));
    expect(first.getByLabelText<HTMLInputElement>('有効').checked).toBe(true);
    expect(first.getByLabelText<HTMLInputElement>('from').value).toBe('a.atlassian.net');
    expect(first.getByLabelText<HTMLInputElement>('to').value).toBe('b.atlassian.net');
  });

  it('reflects a disabled rule in its checkbox', () => {
    setup();
    expect(within(row('2')).getByLabelText<HTMLInputElement>('有効').checked).toBe(false);
  });

  it('shows an empty state row when there are no rules', () => {
    setup([]);
    expect(document.querySelectorAll('tr[data-id]')).toHaveLength(0);
    expect(screen.getByText('ルールがありません。「追加」から登録してください。')).toBeTruthy();
  });

  it('shows the status message it is given', () => {
    render(
      <RulesTable
        rules={sample}
        status="保存しました"
        onChange={onChange}
        onDelete={onDelete}
        onAdd={onAdd}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('保存しました');
  });

  it('reports nothing while rendering', () => {
    setup();
    expect(onChange).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onAdd).not.toHaveBeenCalled();
  });
});

describe('editing a rule', () => {
  it('reports a toggle', () => {
    setup();
    fireEvent.click(within(row('1')).getByLabelText('有効'));
    expect(onChange).toHaveBeenCalledWith('1', { enabled: false });
  });

  it('reports enabling a disabled rule', () => {
    setup();
    fireEvent.click(within(row('2')).getByLabelText('有効'));
    expect(onChange).toHaveBeenCalledWith('2', { enabled: true });
  });

  it('reports an edit of from', () => {
    setup();
    fireEvent.change(within(row('1')).getByLabelText('from'), {
      target: { value: 'old.atlassian.net' },
    });
    expect(onChange).toHaveBeenCalledWith('1', { from: 'old.atlassian.net' });
  });

  it('reports an edit of to', () => {
    setup();
    fireEvent.change(within(row('2')).getByLabelText('to'), {
      target: { value: 'new.atlassian.net' },
    });
    expect(onChange).toHaveBeenCalledWith('2', { to: 'new.atlassian.net' });
  });
});

describe('deleting a rule', () => {
  it('reports the row to remove', () => {
    setup();
    fireEvent.click(within(row('1')).getByRole('button', { name: '削除' }));
    expect(onDelete).toHaveBeenCalledWith('1');
  });
});

describe('adding a rule', () => {
  it('reports the request to add one', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: '＋ 追加' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('puts the caret in the from input of the row it is told to focus', () => {
    setup(sample, '2');
    expect(document.activeElement).toBe(within(row('2')).getByLabelText('from'));
  });
});
