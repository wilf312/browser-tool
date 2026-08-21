import { describe, it, expect, beforeEach } from 'vitest';
import { findKeepWaitingButton } from './meet-keep-waiting';

/** The dialog Meet shows while a meeting has not let you in yet. */
function dialog(buttons: string, role = 'dialog'): void {
  document.body.innerHTML = `
    <div role="${role}">
      <h2>まだ通話から退出していません</h2>
      <p>まだ参加できないようです。このまま待機を続けますか？</p>
      ${buttons}
    </div>
  `;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findKeepWaitingButton', () => {
  it('finds the Japanese 待機 button', () => {
    dialog('<button>退出</button><button>待機</button>');
    expect(findKeepWaitingButton(document)?.textContent).toBe('待機');
  });

  it('finds the English button', () => {
    dialog('<button>Leave</button><button>Keep waiting</button>');
    expect(findKeepWaitingButton(document)?.textContent).toBe('Keep waiting');
  });

  it('matches the label whatever its case and surrounding whitespace', () => {
    dialog('<button>  KEEP WAITING  </button>');
    expect(findKeepWaitingButton(document)).toBeTruthy();
  });

  it('finds a role=button element by its aria-label', () => {
    dialog('<div role="button" aria-label="待機"></div>');
    expect(findKeepWaitingButton(document)?.getAttribute('aria-label')).toBe('待機');
  });

  it('finds the button in an alertdialog too', () => {
    dialog('<button>待機</button>', 'alertdialog');
    expect(findKeepWaitingButton(document)?.textContent).toBe('待機');
  });

  it('never picks the 退出 button', () => {
    dialog('<button>退出</button>');
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('only matches a whole label, not 待機室 or 待機中', () => {
    dialog('<button>待機室を開く</button><button>待機中の参加者</button>');
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('leaves 待機 outside a dialog alone', () => {
    document.body.innerHTML = '<button>待機</button>';
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('returns null while no dialog is up', () => {
    document.body.innerHTML = '<div role="dialog"><button>OK</button></div>';
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('skips buttons that cannot be clicked', () => {
    dialog(`
      <button disabled>待機</button>
      <button aria-disabled="true">待機</button>
      <button hidden>待機</button>
      <button aria-hidden="true">待機</button>
    `);
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('ignores a dialog that is hidden from assistive tech', () => {
    document.body.innerHTML = '<div role="dialog" aria-hidden="true"><button>待機</button></div>';
    expect(findKeepWaitingButton(document)).toBeNull();
  });

  it('copes with a missing root', () => {
    expect(findKeepWaitingButton(null)).toBeNull();
    expect(findKeepWaitingButton(undefined)).toBeNull();
  });
});
