import { describe, it, expect, vi } from 'vitest';
import { createAutoMerge } from './github-auto-merge';
import type { CiStatus } from './github-ci-status';

function setup(overrides: { status?: CiStatus; time?: number } = {}) {
  let status: CiStatus = overrides.status ?? 'pending';
  let time = overrides.time ?? 0;
  const mergeButton = { click: vi.fn() };
  const confirmButton = { click: vi.fn() };
  let mergeButtonPresent = true;
  let confirmButtonPresent = false;
  const updates: string[] = [];

  const controller = createAutoMerge({
    now: () => time,
    findCiStatus: () => status,
    findMergeButton: () => (mergeButtonPresent ? mergeButton : null),
    findConfirmButton: () => (confirmButtonPresent ? confirmButton : null),
    confirmWindowMs: 15000,
    onUpdate: (snapshot) => updates.push(snapshot.state),
  });

  return {
    controller,
    mergeButton,
    confirmButton,
    updates,
    setStatus: (next: CiStatus) => {
      status = next;
    },
    setTime: (next: number) => {
      time = next;
    },
    setMergeButtonPresent: (present: boolean) => {
      mergeButtonPresent = present;
    },
    setConfirmButtonPresent: (present: boolean) => {
      confirmButtonPresent = present;
    },
  };
}

describe('createAutoMerge', () => {
  it('starts off', () => {
    const { controller } = setup();
    expect(controller.getSnapshot().state).toBe('off');
  });

  it('does nothing while off, even if checks are already green', () => {
    const { controller, mergeButton, setStatus } = setup();
    setStatus('success');
    controller.tick();
    expect(controller.getSnapshot().state).toBe('off');
    expect(mergeButton.click).not.toHaveBeenCalled();
  });

  it('keeps waiting while checks are pending', () => {
    const { controller, mergeButton } = setup({ status: 'pending' });
    controller.start();
    controller.tick();
    expect(controller.getSnapshot().state).toBe('watching');
    expect(mergeButton.click).not.toHaveBeenCalled();
  });

  it('clicks the merge button once every check passes', () => {
    const { controller, mergeButton, setStatus } = setup({ status: 'pending' });
    controller.start();
    setStatus('success');
    controller.tick();

    expect(mergeButton.click).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().state).toBe('merging');
  });

  it('confirms the merge once the commit message form appears', () => {
    const { controller, confirmButton, setStatus, setConfirmButtonPresent } = setup({
      status: 'pending',
    });
    controller.start();
    setStatus('success');
    controller.tick(); // clicks merge, enters 'merging'

    setConfirmButtonPresent(true);
    controller.tick();

    expect(confirmButton.click).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot().state).toBe('done');
  });

  it('keeps waiting for the confirm button within the window', () => {
    const { controller, confirmButton, setStatus, setTime } = setup({ status: 'pending', time: 0 });
    controller.start();
    setStatus('success');
    controller.tick();

    setTime(10000);
    controller.tick();

    expect(confirmButton.click).not.toHaveBeenCalled();
    expect(controller.getSnapshot().state).toBe('merging');
  });

  it('gives up if the confirm button never shows up', () => {
    const { controller, setStatus, setTime } = setup({ status: 'pending', time: 0 });
    controller.start();
    setStatus('success');
    controller.tick();

    setTime(20000);
    controller.tick();

    expect(controller.getSnapshot().state).toBe('failed');
  });

  it('stops watching if a check fails', () => {
    const { controller, mergeButton, setStatus } = setup({ status: 'pending' });
    controller.start();
    setStatus('failure');
    controller.tick();

    expect(controller.getSnapshot().state).toBe('failed');
    expect(mergeButton.click).not.toHaveBeenCalled();
  });

  it('settles as done when the pull request was already merged elsewhere', () => {
    const { controller, setStatus, setMergeButtonPresent } = setup({ status: 'pending' });
    controller.start();
    setStatus('success');
    setMergeButtonPresent(false);
    controller.tick();

    expect(controller.getSnapshot().state).toBe('done');
  });

  it('can be turned off while watching', () => {
    const { controller, mergeButton, setStatus } = setup({ status: 'pending' });
    controller.start();
    controller.stop();

    setStatus('success');
    controller.tick();

    expect(controller.getSnapshot().state).toBe('off');
    expect(mergeButton.click).not.toHaveBeenCalled();
  });

  it('reports every transition through onUpdate', () => {
    const { controller, setStatus, updates } = setup({ status: 'pending' });
    controller.start();
    setStatus('success');
    controller.tick();

    expect(updates).toEqual(['watching', 'merging']);
  });

  it('ignores stop() once it is no longer watching', () => {
    const { controller, setStatus } = setup({ status: 'pending' });
    controller.start();
    setStatus('success');
    controller.tick(); // now merging

    controller.stop();
    expect(controller.getSnapshot().state).toBe('merging');
  });

  it('ignores a second start() while already watching', () => {
    const { controller, updates } = setup({ status: 'pending' });
    controller.start();
    controller.start();
    expect(updates).toEqual(['watching']);
  });
});
