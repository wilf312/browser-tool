import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useStatus } from './useStatus';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useStatus', () => {
  it('starts with nothing to say', () => {
    const { result } = renderHook(() => useStatus());
    expect(result.current[0]).toBe('');
  });

  it('shows the message it is given', () => {
    const { result } = renderHook(() => useStatus());

    act(() => result.current[1]('保存しました'));
    expect(result.current[0]).toBe('保存しました');
  });

  it('clears the message again after the delay', () => {
    const { result } = renderHook(() => useStatus(1500));

    act(() => result.current[1]('保存しました'));
    act(() => vi.advanceTimersByTime(1499));
    expect(result.current[0]).toBe('保存しました');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current[0]).toBe('');
  });

  it('honours a custom delay', () => {
    const { result } = renderHook(() => useStatus(50));

    act(() => result.current[1]('保存しました'));
    act(() => vi.advanceTimersByTime(50));
    expect(result.current[0]).toBe('');
  });

  it('restarts the countdown when a second message arrives', () => {
    const { result } = renderHook(() => useStatus(1000));

    act(() => result.current[1]('保存しました'));
    act(() => vi.advanceTimersByTime(900));
    act(() => result.current[1]('保存に失敗しました'));

    // The first message's timer must not clear the second one early.
    act(() => vi.advanceTimersByTime(900));
    expect(result.current[0]).toBe('保存に失敗しました');

    act(() => vi.advanceTimersByTime(100));
    expect(result.current[0]).toBe('');
  });

  it('does not touch state after the component is gone', () => {
    const { result, unmount } = renderHook(() => useStatus(1000));

    act(() => result.current[1]('保存しました'));
    unmount();

    expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
