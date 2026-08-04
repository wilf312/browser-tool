/**
 * The little box in the corner of the Meet waiting screen.
 *
 * It exists so the auto join is never a surprise: it says when the click will
 * happen, counts down to it, and offers a way out. Everything lives in a shadow
 * root so Meet's stylesheet cannot reach it (and ours cannot reach Meet).
 */

import { formatClock, formatCountdown } from '../lib/meet-schedule.js';

export const PANEL_ID = 'browser-tool-meet-auto-join';

const STYLE = `
  .panel {
    box-sizing: border-box;
    min-width: 232px;
    padding: 12px 14px;
    border-radius: 10px;
    background: #202124;
    color: #e8eaed;
    box-shadow: 0 4px 16px rgb(0 0 0 / 35%);
    font: 13px/1.5 system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif;
  }
  .title {
    margin-bottom: 2px;
    font-size: 11px;
    letter-spacing: .04em;
    text-transform: uppercase;
    color: #9aa0a6;
  }
  .message { font-weight: 600; }
  .countdown {
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
    color: #9aa0a6;
  }
  .cancel {
    margin-top: 10px;
    padding: 4px 10px;
    border: 1px solid #5f6368;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .cancel:hover { border-color: #8ab4f8; color: #8ab4f8; }
  .cancel[hidden] { display: none; }
`;

function describe({ state, joinAt }) {
  switch (state) {
    case 'joined':
      return '参加しました';
    case 'cancelled':
      return '自動入室をキャンセルしました';
    case 'missed':
      return '参加ボタンが見つかりませんでした';
    default:
      return `${formatClock(joinAt)} に自動で参加します`;
  }
}

export function createPanel({ document, onCancel = () => {} }) {
  const host = document.createElement('div');
  host.id = PANEL_ID;
  host.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;';

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLE;

  const panel = document.createElement('div');
  panel.className = 'panel';

  const title = document.createElement('div');
  title.className = 'title';
  title.textContent = 'Meet 自動入室';

  const message = document.createElement('div');
  message.className = 'message';

  const countdown = document.createElement('div');
  countdown.className = 'countdown';

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'cancel';
  cancel.textContent = 'キャンセル';
  cancel.addEventListener('click', () => onCancel());

  panel.append(title, message, countdown, cancel);
  shadow.append(style, panel);

  return {
    host,

    mount() {
      (document.body ?? document.documentElement).append(host);
    },

    update(snapshot) {
      message.textContent = describe(snapshot);
      const waiting = snapshot.state === 'waiting';
      countdown.textContent = waiting ? `残り ${formatCountdown(snapshot.remainingMs)}` : '';
      cancel.hidden = !waiting;
    },

    destroy() {
      host.remove();
    },
  };
}
