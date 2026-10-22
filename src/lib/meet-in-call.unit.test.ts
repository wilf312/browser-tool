import { describe, it, expect, beforeEach } from 'vitest';
import { isInCall } from './meet-in-call';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isInCall', () => {
  it('sees the Japanese hang-up button', () => {
    document.body.innerHTML = '<button aria-label="通話から退出"><i>call_end</i></button>';
    expect(isInCall(document)).toBe(true);
  });

  it('sees the English hang-up button', () => {
    document.body.innerHTML = '<button aria-label="Leave call"><i>call_end</i></button>';
    expect(isInCall(document)).toBe(true);
  });

  it.each([
    ['German', 'Anruf verlassen'],
    ['Spanish', 'Salir de la llamada'],
    ['Chinese', '退出通话'],
  ])('sees the %s hang-up button', (_language, label) => {
    document.body.innerHTML = `<button aria-label="${label}"><i>call_end</i></button>`;
    expect(isInCall(document)).toBe(true);
  });

  it('matches the label whatever its case and surrounding whitespace', () => {
    document.body.innerHTML = '<div role="button">  LEAVE CALL  </div>';
    expect(isInCall(document)).toBe(true);
  });

  it('is false on the waiting screen', () => {
    document.body.innerHTML = '<button>今すぐ参加</button><button>その他の参加オプション</button>';
    expect(isInCall(document)).toBe(false);
  });

  it('only matches a whole label', () => {
    document.body.innerHTML =
      '<button>通話から退出しました</button><button>Leave call settings</button>';
    expect(isInCall(document)).toBe(false);
  });

  it('does not take the 退出 button of the keep-waiting dialog for the call', () => {
    document.body.innerHTML = `
      <div role="dialog">
        <h2>まだ通話から退出していません</h2>
        <button>退出</button>
        <button>待機</button>
      </div>
    `;
    expect(isInCall(document)).toBe(false);
  });

  it('leaves buttons inside a dialog out, whatever their label', () => {
    document.body.innerHTML = '<div role="alertdialog"><button>通話から退出</button></div>';
    expect(isInCall(document)).toBe(false);
  });

  it('skips a hang-up button that cannot be clicked', () => {
    document.body.innerHTML = `
      <button hidden aria-label="通話から退出"></button>
      <div aria-hidden="true"><button aria-label="Leave call"></button></div>
    `;
    expect(isInCall(document)).toBe(false);
  });

  it('copes with a missing root', () => {
    expect(isInCall(null)).toBe(false);
    expect(isInCall(undefined)).toBe(false);
  });
});
