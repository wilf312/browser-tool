import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { start, type Running } from './github-auto-merge';
import { TOGGLE_ID } from './github-merge-toggle';

const PR_URL = 'https://github.com/wilf312/browser-tool/pull/42';

type Status = 'pending' | 'success' | 'failure';

let url: string;
let running: Running | null;
let heading: HTMLElement;
let mergeButton: HTMLButtonElement;

function toggle(): HTMLButtonElement | null {
  return document.getElementById(TOGGLE_ID) as HTMLButtonElement | null;
}

function headingFor(status: Status): string {
  if (status === 'success') return 'All checks have passed';
  if (status === 'failure') return 'Some checks were not successful';
  return "Some checks haven't completed yet";
}

/** Fresh merge box: only used before a toggle exists, since it wipes the page. */
function renderMergeBox(status: Status, onMergeClick: Mock<() => void>) {
  document.body.innerHTML = '';
  heading = document.createElement('h3');
  document.body.append(heading);
  mergeButton = document.createElement('button');
  mergeButton.textContent = 'Merge pull request';
  mergeButton.addEventListener('click', onMergeClick);
  document.body.append(mergeButton);
  setStatus(status);
}

/**
 * GitHub re-renders the merge box heading in place as checks come in — this
 * changes only the status text, never touching the merge button node the
 * toggle was anchored to.
 */
function setStatus(status: Status) {
  heading.textContent = headingFor(status);
}

/** The merge button as GitHub swaps it out once the commit form opens. */
function replaceMergeButtonWithConfirmForm(onConfirmClick: Mock<() => void>) {
  mergeButton.textContent = ''; // no longer matches any merge label
  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Confirm merge';
  confirmButton.addEventListener('click', onConfirmClick);
  document.body.append(confirmButton);
}

/** The pull request got merged from elsewhere while we were watching. */
function replaceMergeBoxWithMergedNotice() {
  mergeButton.textContent = '';
}

async function run() {
  running = start({
    document,
    getUrl: () => url,
    now: () => Date.now(),
    tickMs: 1000,
    urlPollMs: 1000,
    dismissMs: 5000,
  });
  await vi.advanceTimersByTimeAsync(0);
}

async function tick(ms = 1000) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  document.body.innerHTML = '';
  url = PR_URL;
  running = null;
});

afterEach(() => {
  running?.stop();
  vi.useRealTimers();
});

describe('github auto merge content script', () => {
  it('shows the toggle next to the merge button while checks are pending', async () => {
    renderMergeBox('pending', vi.fn());
    await run();

    expect(toggle()?.textContent).toBe('CIがgreenになったら自動マージ');
    expect(toggle()?.previousElementSibling).toBe(mergeButton);
  });

  it('does not show the toggle once checks have already passed', async () => {
    renderMergeBox('success', vi.fn());
    await run();
    await tick();

    expect(toggle()).toBeNull();
  });

  it('does not show the toggle when checks have already failed', async () => {
    renderMergeBox('failure', vi.fn());
    await run();
    await tick();

    expect(toggle()).toBeNull();
  });

  it('does nothing on pages that are not a pull request', async () => {
    url = 'https://github.com/wilf312/browser-tool';
    renderMergeBox('pending', vi.fn());
    await run();

    expect(toggle()).toBeNull();
  });

  it('watches once the toggle is switched on', async () => {
    renderMergeBox('pending', vi.fn());
    await run();

    toggle()?.click();
    expect(toggle()?.textContent).toBe('CIを監視中…（クリックで解除）');
  });

  it('merges once every check passes', async () => {
    const onMergeClick = vi.fn();
    renderMergeBox('pending', onMergeClick);
    await run();
    toggle()?.click();

    setStatus('success');
    await tick();

    expect(onMergeClick).toHaveBeenCalledTimes(1);
    expect(toggle()?.textContent).toBe('マージしています…');
  });

  it('confirms the merge once the commit message form is open', async () => {
    const onMergeClick = vi.fn();
    const onConfirmClick = vi.fn();
    renderMergeBox('pending', onMergeClick);
    await run();
    toggle()?.click();

    setStatus('success');
    await tick();

    replaceMergeButtonWithConfirmForm(onConfirmClick);
    await tick();

    expect(onConfirmClick).toHaveBeenCalledTimes(1);
    expect(toggle()?.textContent).toBe('マージしました');
  });

  it('removes the toggle a moment after merging', async () => {
    const onConfirmClick = vi.fn();
    renderMergeBox('pending', vi.fn());
    await run();
    toggle()?.click();

    setStatus('success');
    await tick();
    replaceMergeButtonWithConfirmForm(onConfirmClick);
    await tick();
    expect(toggle()).toBeTruthy();

    await tick(5000);
    expect(toggle()).toBeNull();
  });

  it('settles as done when the merge box disappears mid-watch', async () => {
    renderMergeBox('pending', vi.fn());
    await run();
    toggle()?.click();

    setStatus('success');
    replaceMergeBoxWithMergedNotice();
    await tick();

    expect(toggle()?.textContent).toBe('マージしました');
    await tick(5000);
    expect(toggle()).toBeNull();
  });

  it('stops watching when the toggle is switched off', async () => {
    const onMergeClick = vi.fn();
    renderMergeBox('pending', onMergeClick);
    await run();
    toggle()?.click();
    toggle()?.click();

    expect(toggle()?.textContent).toBe('CIがgreenになったら自動マージ');

    setStatus('success');
    await tick();
    expect(onMergeClick).not.toHaveBeenCalled();
  });

  it('stops on its own when a check fails while watching', async () => {
    renderMergeBox('pending', vi.fn());
    await run();
    toggle()?.click();

    setStatus('failure');
    await tick();

    expect(toggle()?.textContent).toBe('CIが失敗しました');

    await tick(5000);
    expect(toggle()).toBeNull();
  });

  it('gives up waiting for the confirm form and reports failure', async () => {
    const onMergeClick = vi.fn();
    renderMergeBox('pending', onMergeClick);
    await run();
    toggle()?.click();

    setStatus('success');
    await tick();
    expect(toggle()?.textContent).toBe('マージしています…');

    await tick(16000);
    expect(toggle()?.textContent).toBe('CIが失敗しました');
  });

  it('gives a fresh toggle its own pull request when the single page app navigates', async () => {
    renderMergeBox('pending', vi.fn());
    await run();
    toggle()?.click();
    expect(toggle()?.textContent).toBe('CIを監視中…（クリックで解除）');

    url = 'https://github.com/wilf312/browser-tool/pull/43';
    renderMergeBox('pending', vi.fn());
    await tick();

    expect(toggle()?.textContent).toBe('CIがgreenになったら自動マージ');
  });

  it('tears the toggle down when navigating away from a pull request', async () => {
    renderMergeBox('pending', vi.fn());
    await run();
    expect(toggle()).toBeTruthy();

    url = 'https://github.com/wilf312/browser-tool';
    await tick();
    expect(toggle()).toBeNull();
  });

  it('stops cleanly', async () => {
    const onMergeClick = vi.fn();
    renderMergeBox('pending', onMergeClick);
    await run();
    toggle()?.click();

    running?.stop();
    running = null;

    setStatus('success');
    await tick();
    expect(onMergeClick).not.toHaveBeenCalled();
  });
});
