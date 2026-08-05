import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { createPanel, PANEL_ID, type Panel } from './meet-panel';
import { MeetPanel, describe as describeSnapshot } from './MeetPanel';
import type { AutoJoinSnapshot, AutoJoinState } from '../lib/types';

const JOIN_AT = new Date(2026, 0, 15, 10, 15);

function snapshot(state: AutoJoinState = 'waiting', remainingMs = 8 * 60 * 1000): AutoJoinSnapshot {
  return { state, joinAt: JOIN_AT, remainingMs };
}

function text(selector: string): string | null {
  return document.querySelector(selector)?.textContent ?? null;
}

describe('describeSnapshot', () => {
  it('announces the scheduled join while waiting', () => {
    expect(describeSnapshot(snapshot('waiting'))).toBe('10:15 に自動で参加します');
  });

  it('has a message for every settled state', () => {
    expect(describeSnapshot(snapshot('joined'))).toBe('参加しました');
    expect(describeSnapshot(snapshot('cancelled'))).toBe('自動入室をキャンセルしました');
    expect(describeSnapshot(snapshot('missed'))).toBe('参加ボタンが見つかりませんでした');
  });
});

describe('<MeetPanel />', () => {
  it('shows the title, the message and the countdown while waiting', () => {
    render(<MeetPanel snapshot={snapshot()} onCancel={() => {}} onDismiss={() => {}} />);

    expect(text('.title')).toBe('Meet 自動入室');
    expect(text('.message')).toBe('10:15 に自動で参加します');
    expect(text('.countdown')).toBe('残り 08:00');
  });

  it('offers a way out while waiting', () => {
    const onCancel = vi.fn();
    render(<MeetPanel snapshot={snapshot()} onCancel={onCancel} onDismiss={() => {}} />);

    const cancel = screen.getByRole('button', { name: 'キャンセル' });
    expect((cancel as HTMLButtonElement).hidden).toBe(false);

    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('drops the countdown and the cancel button once it has settled', () => {
    render(<MeetPanel snapshot={snapshot('joined', 0)} onCancel={() => {}} onDismiss={() => {}} />);

    expect(text('.message')).toBe('参加しました');
    expect(document.querySelector('.countdown')).toBeNull();
    expect(document.querySelector<HTMLButtonElement>('.cancel')?.hidden).toBe(true);
  });

  it('says the settled panel can be clicked away', () => {
    render(
      <MeetPanel snapshot={snapshot('cancelled', 0)} onCancel={() => {}} onDismiss={() => {}} />,
    );

    expect(text('.hint')).toBe('クリックで閉じる');
    expect(document.querySelector('.panel')?.classList.contains('dismissible')).toBe(true);
  });

  it('dismisses when the settled panel is clicked anywhere', () => {
    const onDismiss = vi.fn();
    render(
      <MeetPanel snapshot={snapshot('cancelled', 0)} onCancel={() => {}} onDismiss={onDismiss} />,
    );

    fireEvent.click(document.querySelector('.title') as HTMLElement);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses the settled panel from the keyboard', () => {
    const onDismiss = vi.fn();
    render(
      <MeetPanel snapshot={snapshot('joined', 0)} onCancel={() => {}} onDismiss={onDismiss} />,
    );

    const panel = document.querySelector('.panel') as HTMLElement;
    expect(panel.tabIndex).toBe(0);

    fireEvent.keyDown(panel, { key: 'Enter' });
    fireEvent.keyDown(panel, { key: ' ' });
    fireEvent.keyDown(panel, { key: 'a' });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('keeps the running countdown when the panel itself is clicked', () => {
    const onDismiss = vi.fn();
    render(<MeetPanel snapshot={snapshot()} onCancel={() => {}} onDismiss={onDismiss} />);

    const panel = document.querySelector('.panel') as HTMLElement;
    fireEvent.click(panel);
    fireEvent.keyDown(panel, { key: 'Enter' });

    expect(onDismiss).not.toHaveBeenCalled();
    expect(panel.classList.contains('dismissible')).toBe(false);
  });

  it('carries its own styles', () => {
    render(<MeetPanel snapshot={snapshot()} onCancel={() => {}} onDismiss={() => {}} />);
    expect(document.querySelector('style')?.textContent).toContain('.panel');
  });
});

describe('createPanel', () => {
  let panel: Panel;

  function shadowText(selector: string): string | null {
    return panel.host.shadowRoot?.querySelector(selector)?.textContent ?? null;
  }

  beforeEach(() => {
    document.body.innerHTML = '';
    panel = createPanel({ document });
  });

  afterEach(() => {
    panel.destroy();
  });

  it('builds a pinned host with a shadow root, but does not attach it yet', () => {
    expect(panel.host.id).toBe(PANEL_ID);
    expect(panel.host.style.position).toBe('fixed');
    expect(panel.host.shadowRoot).toBeTruthy();
    expect(document.getElementById(PANEL_ID)).toBeNull();
  });

  it('sits in the bottom-left corner, clear of Meet own bottom-right buttons', () => {
    expect(panel.host.style.left).toBe('16px');
    expect(panel.host.style.bottom).toBe('16px');
    expect(panel.host.style.right).toBe('');
  });

  it('keeps the panel out of the page styles by rendering into the shadow root', () => {
    panel.mount();
    panel.update(snapshot());

    expect(document.getElementById(PANEL_ID)).toBe(panel.host);
    expect(shadowText('.message')).toBe('10:15 に自動で参加します');
    expect(document.querySelector('.message')).toBeNull();
  });

  it('ignores an update before it is mounted', () => {
    panel.update(snapshot());
    expect(panel.host.shadowRoot?.childNodes).toHaveLength(0);
  });

  it('re-renders on every update', () => {
    panel.mount();
    panel.update(snapshot());
    panel.update(snapshot('joined', 0));

    expect(shadowText('.message')).toBe('参加しました');
  });

  it('mounts only once, keeping the rendered panel across repeated mounts', () => {
    panel.mount();
    panel.update(snapshot());
    panel.mount();

    expect(document.querySelectorAll(`#${PANEL_ID}`)).toHaveLength(1);
    expect(shadowText('.message')).toBe('10:15 に自動で参加します');
  });

  it('reports a cancel to the caller', () => {
    const onCancel = vi.fn();
    const cancellable = createPanel({ document, onCancel });
    cancellable.mount();
    cancellable.update(snapshot());

    cancellable.host.shadowRoot?.querySelector<HTMLElement>('.cancel')?.click();
    expect(onCancel).toHaveBeenCalledTimes(1);
    cancellable.destroy();
  });

  it('reports a dismiss of the settled panel to the caller', () => {
    const onDismiss = vi.fn();
    const dismissible = createPanel({ document, onDismiss });
    dismissible.mount();
    dismissible.update(snapshot('cancelled', 0));

    dismissible.host.shadowRoot?.querySelector<HTMLElement>('.panel')?.click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    dismissible.destroy();
  });

  it('survives a dismiss when the caller did not ask to hear about it', () => {
    panel.mount();
    panel.update(snapshot('cancelled', 0));

    expect(() =>
      panel.host.shadowRoot?.querySelector<HTMLElement>('.panel')?.click(),
    ).not.toThrow();
  });

  it('survives a cancel when the caller did not ask to hear about it', () => {
    panel.mount();
    panel.update(snapshot());

    expect(() =>
      panel.host.shadowRoot?.querySelector<HTMLElement>('.cancel')?.click(),
    ).not.toThrow();
  });

  it('takes the host off the page and tears the React tree down when destroyed', () => {
    panel.mount();
    panel.update(snapshot());
    const { shadowRoot } = panel.host;
    expect(shadowRoot?.querySelector('.panel')).toBeTruthy();

    panel.destroy();

    expect(document.getElementById(PANEL_ID)).toBeNull();
    expect(shadowRoot?.childNodes).toHaveLength(0);
  });

  it('ignores an update after it has been destroyed', () => {
    panel.mount();
    panel.destroy();

    expect(() => panel.update(snapshot())).not.toThrow();
    expect(document.getElementById(PANEL_ID)).toBeNull();
  });

  it('can be destroyed before it was ever mounted', () => {
    expect(() => panel.destroy()).not.toThrow();
  });

  it('falls back to the document element on a page without a body', () => {
    const documentElement = document.createElement('html');
    const bodyless = {
      createElement: (tag: string) => document.createElement(tag),
      body: null,
      documentElement,
    } as unknown as Document;

    const orphan = createPanel({ document: bodyless });
    orphan.mount();

    expect(documentElement.contains(orphan.host)).toBe(true);
    orphan.destroy();
  });
});
