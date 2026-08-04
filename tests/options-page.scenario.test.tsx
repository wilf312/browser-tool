import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { App } from '../src/options/App';
import { STORAGE_KEY } from '../src/lib/storage';
import { MEET_SETTINGS_KEY } from '../src/lib/meet-settings';
import type { MeetSettings, RedirectRule } from '../src/lib/types';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from './fake-chrome';

let chrome: FakeChrome;

/** Render the settings page and wait for the initial load to settle. */
async function mount(initialRules: RedirectRule[] = [], meetSettings?: MeetSettings) {
  chrome = installFakeChrome({
    storage: {
      [STORAGE_KEY]: initialRules,
      ...(meetSettings ? { [MEET_SETTINGS_KEY]: meetSettings } : {}),
    },
  });
  render(<App />);
  await act(async () => {});
}

/** Let the debounced save fire and its promise resolve. */
async function settleSave() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

function storedRules(): RedirectRule[] {
  return chrome.store[STORAGE_KEY] as RedirectRule[];
}

function rows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('tr[data-id]'));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  uninstallFakeChrome();
});

describe('redirect rules', () => {
  it('renders the stored rules into the table', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    expect(rows()).toHaveLength(1);
    const first = within(rows()[0]);
    expect(first.getByLabelText<HTMLInputElement>('from').value).toBe('a.atlassian.net');
    expect(first.getByLabelText<HTMLInputElement>('to').value).toBe('b.atlassian.net');
    expect(first.getByLabelText<HTMLInputElement>('有効').checked).toBe(true);
  });

  it('shows the empty state when nothing is stored', async () => {
    await mount([]);
    expect(screen.getByText('ルールがありません。「追加」から登録してください。')).toBeTruthy();
  });

  it('persists a toggle after the debounce', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    fireEvent.click(screen.getByLabelText('有効'));

    expect(chrome.sync.set).not.toHaveBeenCalled();
    await settleSave();
    expect(storedRules()).toEqual([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false },
    ]);
  });

  it('collapses typing into a single write', async () => {
    await mount([{ id: '1', from: '', to: '', enabled: true }]);

    const input = screen.getByLabelText('from');
    for (const value of ['a', 'a.', 'a.atlassian.net']) {
      fireEvent.change(input, { target: { value } });
    }

    await settleSave();
    expect(chrome.sync.set).toHaveBeenCalledTimes(1);
    expect(storedRules()[0].from).toBe('a.atlassian.net');
  });

  it('edits one row without disturbing the others', async () => {
    await mount([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
      { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: true },
    ]);

    fireEvent.change(within(rows()[1]).getByLabelText('from'), {
      target: { value: 'e.atlassian.net' },
    });
    fireEvent.click(within(rows()[1]).getByLabelText('有効'));
    await settleSave();

    expect(storedRules()).toEqual([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
      { id: '2', from: 'e.atlassian.net', to: 'd.atlassian.net', enabled: false },
    ]);
  });

  it('keeps the caret in the input being typed into', async () => {
    await mount([{ id: '1', from: '', to: '', enabled: true }]);

    const input = screen.getByLabelText<HTMLInputElement>('from');
    input.focus();
    fireEvent.change(input, { target: { value: 'a.atlassian.net' } });

    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('a.atlassian.net');
  });

  it('adds a rule and persists it', async () => {
    await mount([]);

    fireEvent.click(screen.getByRole('button', { name: '＋ 追加' }));
    await settleSave();

    expect(rows()).toHaveLength(1);
    expect(storedRules()).toHaveLength(1);
    expect(storedRules()[0]).toMatchObject({ from: '', to: '', enabled: true });
  });

  it('focuses the from input of a freshly added rule', async () => {
    await mount([]);

    fireEvent.click(screen.getByRole('button', { name: '＋ 追加' }));

    expect(document.activeElement).toBe(within(rows()[0]).getByLabelText('from'));
  });

  it('deletes a rule and persists the removal', async () => {
    await mount([
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
      { id: '2', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: true },
    ]);

    fireEvent.click(within(rows()[0]).getByRole('button', { name: '削除' }));
    await settleSave();

    expect(storedRules()).toHaveLength(1);
    expect(storedRules()[0].id).toBe('2');
  });

  it('reports the save in the status area', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    fireEvent.click(screen.getByLabelText('有効'));
    await settleSave();

    expect(screen.getAllByRole('status')[0].textContent).toBe('保存しました');
  });

  it('reports a failed save instead of pretending it worked', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
    chrome.sync.set.mockRejectedValueOnce(error);

    fireEvent.click(screen.getByLabelText('有効'));
    await settleSave();

    expect(screen.getAllByRole('status')[0].textContent).toBe('保存に失敗しました');
    expect(logged.mock.calls[0]).toContain(error);
  });

  it('keeps the edit on screen when the save failed', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    chrome.sync.set.mockRejectedValueOnce(new Error('offline'));

    fireEvent.change(screen.getByLabelText('to'), { target: { value: 'z.atlassian.net' } });
    await settleSave();

    expect(screen.getByLabelText<HTMLInputElement>('to').value).toBe('z.atlassian.net');
  });

  it('flushes a pending save when the page is hidden', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    fireEvent.change(screen.getByLabelText('to'), { target: { value: 'z.atlassian.net' } });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(chrome.sync.set).toHaveBeenCalled();
    expect(storedRules()[0].to).toBe('z.atlassian.net');
  });

  it('picks up rules changed in another context', async () => {
    await mount([]);

    act(() => {
      chrome.emitChange(STORAGE_KEY, [
        { id: '9', from: 'x.atlassian.net', to: 'y.atlassian.net', enabled: true },
      ]);
    });

    expect(rows()).toHaveLength(1);
    expect(screen.getByLabelText<HTMLInputElement>('from').value).toBe('x.atlassian.net');
  });

  it('does not clobber a row the user is editing', async () => {
    await mount([{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }]);

    const input = screen.getByLabelText<HTMLInputElement>('from');
    input.focus();

    act(() => {
      chrome.emitChange(STORAGE_KEY, []);
    });

    expect(rows()).toHaveLength(1);
    expect(document.activeElement).toBe(input);
  });
});

describe('meet auto join settings', () => {
  it('renders the stored settings', async () => {
    await mount([], { enabled: true, intervalMinutes: 30 });

    expect(screen.getByLabelText<HTMLInputElement>('自動入室を有効にする').checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('開始時刻の間隔').value).toBe('30');
  });

  it('is off with a 15 minute interval when nothing is stored', async () => {
    await mount([]);

    expect(screen.getByLabelText<HTMLInputElement>('自動入室を有効にする').checked).toBe(false);
    expect(screen.getByLabelText<HTMLSelectElement>('開始時刻の間隔').value).toBe('15');
  });

  it('writes the toggle straight away', async () => {
    await mount([]);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('自動入室を有効にする'));
    });

    expect(chrome.store[MEET_SETTINGS_KEY]).toEqual({ enabled: true, intervalMinutes: 15 });
    expect(screen.getAllByRole('status')[1].textContent).toBe('保存しました');
  });

  it('writes the interval straight away', async () => {
    await mount([], { enabled: true, intervalMinutes: 15 });

    await act(async () => {
      fireEvent.change(screen.getByLabelText('開始時刻の間隔'), { target: { value: '5' } });
    });

    expect(chrome.store[MEET_SETTINGS_KEY]).toEqual({ enabled: true, intervalMinutes: 5 });
  });

  it('reports a failed save instead of pretending it worked', async () => {
    await mount([]);
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('MAX_WRITE_OPERATIONS_PER_MINUTE quota exceeded');
    chrome.sync.set.mockRejectedValueOnce(error);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('自動入室を有効にする'));
    });

    expect(screen.getAllByRole('status')[1].textContent).toBe('保存に失敗しました');
    expect(logged.mock.calls[0]).toContain(error);
    // The checkbox still shows what the user asked for, not what got stored.
    expect(screen.getByLabelText<HTMLInputElement>('自動入室を有効にする').checked).toBe(true);
  });

  it('clears the status message again once it has been read', async () => {
    await mount([]);

    await act(async () => {
      fireEvent.click(screen.getByLabelText('自動入室を有効にする'));
    });
    expect(screen.getAllByRole('status')[1].textContent).toBe('保存しました');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getAllByRole('status')[1].textContent).toBe('');
  });

  it('picks up settings changed in another context', async () => {
    await mount([]);

    act(() => {
      chrome.emitChange(MEET_SETTINGS_KEY, { enabled: true, intervalMinutes: 60 });
    });

    expect(screen.getByLabelText<HTMLInputElement>('自動入室を有効にする').checked).toBe(true);
    expect(screen.getByLabelText<HTMLSelectElement>('開始時刻の間隔').value).toBe('60');
  });

  it('leaves the interval alone while the user has the dropdown open', async () => {
    await mount([]);

    const select = screen.getByLabelText<HTMLSelectElement>('開始時刻の間隔');
    select.focus();

    act(() => {
      chrome.emitChange(MEET_SETTINGS_KEY, { enabled: true, intervalMinutes: 60 });
    });

    expect(select.value).toBe('15');
  });
});
