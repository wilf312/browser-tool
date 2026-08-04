import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { debounce } from '../src/lib/debounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debounce', () => {
  it('does not call the function straight away', () => {
    const fn = vi.fn();
    debounce(fn, 300)();
    expect(fn).not.toHaveBeenCalled();
  });

  it('calls the function once the delay has passed', () => {
    const fn = vi.fn();
    debounce(fn, 300)('a');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('collapses rapid calls into a single one with the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(100);
    debounced('b');
    vi.advanceTimersByTime(100);
    debounced('c');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledExactlyOnceWith('c');
  });

  it('runs again after the previous call has settled', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    debounced('b');
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('flushes a pending call immediately', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    debounced.flush();
    expect(fn).toHaveBeenCalledExactlyOnceWith('a');

    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does nothing when flushed with no pending call', () => {
    const fn = vi.fn();
    debounce(fn, 300).flush();
    expect(fn).not.toHaveBeenCalled();
  });

  it('does nothing when flushed again after the call went through', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);
    debounced('a');
    vi.advanceTimersByTime(300);
    debounced.flush();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits 300ms unless told otherwise', () => {
    const fn = vi.fn();
    debounce(fn)('a');

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith('a');
  });

  it('passes every argument through', () => {
    const fn = vi.fn();
    debounce(fn, 300)('a', 2, { c: true });
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledExactlyOnceWith('a', 2, { c: true });
  });
});
