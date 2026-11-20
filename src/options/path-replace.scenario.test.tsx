import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { PathReplaceSection } from './PathReplaceSection';
import { PATH_REPLACE_STORAGE_KEY } from '../lib/path-replace-storage';
import type { PathReplaceRule } from '../lib/types';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';

let chrome: FakeChrome;

const RULE: PathReplaceRule = {
  id: '1',
  pattern: '*.example.com/docs/*',
  from: 'old',
  to: 'new',
  mode: 'confirm',
};

async function mount(rules: PathReplaceRule[] = [], granted: string[] = []) {
  chrome = installFakeChrome({ storage: { [PATH_REPLACE_STORAGE_KEY]: rules }, granted });
  render(<PathReplaceSection />);
  await act(async () => {});
}

async function settleSave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

function storedRules(): PathReplaceRule[] {
  return chrome.store[PATH_REPLACE_STORAGE_KEY] as PathReplaceRule[];
}

function row(index = 0) {
  return within(Array.from(document.querySelectorAll<HTMLElement>('tr[data-id]'))[index]);
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  uninstallFakeChrome();
});

describe('path replace rules', () => {
  it('renders the stored rules', async () => {
    await mount([RULE]);

    expect(row().getByLabelText<HTMLInputElement>('対象').value).toBe('*.example.com/docs/*');
    expect(row().getByLabelText<HTMLInputElement>('置換前').value).toBe('old');
    expect(row().getByLabelText<HTMLInputElement>('置換後').value).toBe('new');
    expect(row().getByLabelText<HTMLSelectElement>('動作').value).toBe('confirm');
  });

  it('shows the empty state when nothing is stored', async () => {
    await mount();
    expect(screen.getByText('ルールがありません。「追加」から登録してください。')).toBeTruthy();
  });

  it('adds a rule that asks before replacing', async () => {
    await mount();

    fireEvent.click(screen.getByRole('button', { name: '＋ 追加' }));
    await settleSave();

    expect(document.activeElement).toBe(row().getByLabelText('対象'));
    expect(storedRules()).toHaveLength(1);
    expect(storedRules()[0]).toMatchObject({ pattern: '', from: '', to: '', mode: 'confirm' });
  });

  it('offers always, ask and off, and saves the pick', async () => {
    await mount([RULE]);

    const select = row().getByLabelText<HTMLSelectElement>('動作');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual([
      '随時',
      '確認',
      '無効',
    ]);

    fireEvent.change(select, { target: { value: 'always' } });
    await settleSave();
    expect(storedRules()[0].mode).toBe('always');
    expect(screen.getByRole('status').textContent).toBe('保存しました');
  });

  it('saves the edited texts', async () => {
    await mount([RULE]);

    fireEvent.change(row().getByLabelText('対象'), { target: { value: 'example.org' } });
    fireEvent.change(row().getByLabelText('置換前'), { target: { value: 'v1' } });
    fireEvent.change(row().getByLabelText('置換後'), { target: { value: 'v2' } });
    await settleSave();

    expect(chrome.sync.set).toHaveBeenCalledTimes(1);
    expect(storedRules()[0]).toMatchObject({ pattern: 'example.org', from: 'v1', to: 'v2' });
  });

  it('deletes a rule', async () => {
    await mount([RULE]);

    fireEvent.click(row().getByRole('button', { name: '削除' }));
    await settleSave();

    expect(storedRules()).toEqual([]);
  });

  it('asks for the rule’s site and shows once it is allowed', async () => {
    await mount([RULE]);

    const allow = row().getByRole('button', { name: '許可する' });
    expect(allow.getAttribute('title')).toBe(
      '*://*.example.com/* でこの拡張機能が動くのを許可します',
    );

    await act(async () => {
      fireEvent.click(allow);
    });

    expect(chrome.permissions.request).toHaveBeenCalledWith({ origins: ['*://*.example.com/*'] });
    expect(row().getByText('許可済み')).toBeTruthy();
    expect(row().queryByRole('button', { name: '許可する' })).toBeNull();
  });

  it('keeps offering access when the user declines', async () => {
    await mount([RULE]);
    chrome.denyPermissionRequests = true;

    await act(async () => {
      fireEvent.click(row().getByRole('button', { name: '許可する' }));
    });

    expect(row().getByRole('button', { name: '許可する' })).toBeTruthy();
  });

  it('shows a site that is already allowed', async () => {
    await mount([RULE], ['*://*.example.com/*']);
    expect(row().getByText('許可済み')).toBeTruthy();
  });

  it('warns about a rule that would replace forever', async () => {
    await mount([{ ...RULE, from: 'v1', to: 'v1/new' }]);
    expect(screen.getByRole('alert').textContent).toBe(
      '置換後に置換前の文字が含まれているため、このルールは動きません',
    );
  });
});
