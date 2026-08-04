import { describe, it, expect, vi } from 'vitest';
import { createAutoJoin } from '../src/lib/meet-auto-join.js';

function at(hours, minutes, seconds = 0) {
  return new Date(2026, 0, 15, hours, minutes, seconds);
}

/** A clock the test moves by hand. */
function clock(start) {
  let current = start;
  return {
    now: () => current,
    set(next) {
      current = next;
    },
  };
}

function fakeButton() {
  return { click: vi.fn() };
}

describe('createAutoJoin', () => {
  it('targets the next slot and waits for it', () => {
    const time = clock(at(10, 7));
    const button = fakeButton();
    const auto = createAutoJoin({ now: time.now, findButton: () => button });

    expect(auto.getSnapshot().joinAt).toEqual(at(10, 15));

    const snapshot = auto.tick();
    expect(snapshot.state).toBe('waiting');
    expect(snapshot.remainingMs).toBe(8 * 60 * 1000);
    expect(button.click).not.toHaveBeenCalled();
  });

  it('clicks the join button once the slot is reached', () => {
    const time = clock(at(10, 7));
    const button = fakeButton();
    const auto = createAutoJoin({ now: time.now, findButton: () => button });

    time.set(at(10, 15));
    expect(auto.tick().state).toBe('joined');
    expect(button.click).toHaveBeenCalledTimes(1);
  });

  it('clicks only once, however often it is ticked', () => {
    const time = clock(at(10, 14));
    const button = fakeButton();
    const auto = createAutoJoin({ now: time.now, findButton: () => button });

    time.set(at(10, 15));
    auto.tick();
    auto.tick();
    auto.tick();
    expect(button.click).toHaveBeenCalledTimes(1);
  });

  it('keeps waiting for a join button that is not on the page yet', () => {
    const time = clock(at(10, 14));
    const button = fakeButton();
    let visible = false;
    const auto = createAutoJoin({ now: time.now, findButton: () => (visible ? button : null) });

    time.set(at(10, 15));
    expect(auto.tick().state).toBe('waiting');

    visible = true;
    time.set(at(10, 15, 20));
    expect(auto.tick().state).toBe('joined');
    expect(button.click).toHaveBeenCalledTimes(1);
  });

  it('gives up once the join window has passed', () => {
    const time = clock(at(10, 14));
    const auto = createAutoJoin({ now: time.now, findButton: () => null, joinWindowMs: 60_000 });

    time.set(at(10, 16));
    expect(auto.tick().state).toBe('waiting');

    time.set(at(10, 16, 1));
    expect(auto.tick().state).toBe('missed');
  });

  it('does not click after the user cancelled', () => {
    const time = clock(at(10, 7));
    const button = fakeButton();
    const auto = createAutoJoin({ now: time.now, findButton: () => button });

    expect(auto.cancel().state).toBe('cancelled');

    time.set(at(10, 15));
    expect(auto.tick().state).toBe('cancelled');
    expect(button.click).not.toHaveBeenCalled();
  });

  it('ignores a cancel that arrives after the join', () => {
    const time = clock(at(10, 14));
    const button = fakeButton();
    const auto = createAutoJoin({ now: time.now, findButton: () => button });

    time.set(at(10, 15));
    auto.tick();
    expect(auto.cancel().state).toBe('joined');
  });

  it('honours the configured interval', () => {
    const time = clock(at(10, 7));
    const auto = createAutoJoin({ now: time.now, intervalMinutes: 30, findButton: () => null });
    expect(auto.getSnapshot().joinAt).toEqual(at(10, 30));
  });

  it('reports every tick to onUpdate', () => {
    const time = clock(at(10, 7));
    const onUpdate = vi.fn();
    const auto = createAutoJoin({ now: time.now, findButton: () => null, onUpdate });

    auto.tick();
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'waiting', remainingMs: 8 * 60 * 1000 }),
    );
  });
});
