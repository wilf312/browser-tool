import { describe, it, expect, beforeEach } from 'vitest';
import { findJoinButton } from '../src/lib/meet-join';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findJoinButton', () => {
  it('finds the button by its Japanese label', () => {
    document.body.innerHTML = '<button><span>今すぐ参加</span></button>';
    expect(findJoinButton(document)?.textContent).toBe('今すぐ参加');
  });

  it('finds the button by its English label', () => {
    document.body.innerHTML = '<button>Join now</button>';
    expect(findJoinButton(document)?.textContent).toBe('Join now');
  });

  it('finds a role=button element', () => {
    document.body.innerHTML = '<div role="button" aria-label="今すぐ参加"></div>';
    expect(findJoinButton(document)?.getAttribute('aria-label')).toBe('今すぐ参加');
  });

  it('falls back to the request-to-join button', () => {
    document.body.innerHTML = '<button>参加をリクエスト</button>';
    expect(findJoinButton(document)?.textContent).toBe('参加をリクエスト');
  });

  it('prefers joining outright over requesting to join', () => {
    document.body.innerHTML = '<button>参加をリクエスト</button><button>今すぐ参加</button>';
    expect(findJoinButton(document)?.textContent).toBe('今すぐ参加');
  });

  it('does not mistake the participants button for the join button', () => {
    document.body.innerHTML = '<button>参加者</button><button>チャット</button>';
    expect(findJoinButton(document)).toBeNull();
  });

  it('accepts a button labelled exactly 参加', () => {
    document.body.innerHTML = '<button>参加者</button><button> 参加 </button>';
    expect(findJoinButton(document)?.textContent?.trim()).toBe('参加');
  });

  it('skips buttons that cannot be clicked', () => {
    document.body.innerHTML = `
      <button disabled>今すぐ参加</button>
      <button aria-disabled="true">今すぐ参加</button>
      <button hidden>今すぐ参加</button>
      <div aria-hidden="true"><button>今すぐ参加</button></div>
    `;
    expect(findJoinButton(document)).toBeNull();
  });

  it('returns null while the waiting screen is still loading', () => {
    document.body.innerHTML = '<div>接続しています</div>';
    expect(findJoinButton(document)).toBeNull();
  });

  it('returns null without a usable root', () => {
    expect(findJoinButton(null)).toBeNull();
  });
});
