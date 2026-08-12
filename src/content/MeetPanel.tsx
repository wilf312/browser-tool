/**
 * The little box in the corner of the Meet waiting screen.
 *
 * It exists so the auto join is never a surprise: it says when the click will
 * happen, counts down to it, and offers a way out — either off altogether, or
 * one more minute at a time when the wait is the only problem. It is rendered into a shadow
 * root, so the styles travel with the component instead of coming from a
 * stylesheet Meet could reach.
 *
 * Once the countdown has settled the box is only a report, so the whole of it
 * becomes the way to close it — waiting out the dismiss timer for a message you
 * have already read is the annoying part.
 */

import type { KeyboardEvent } from 'react';
import { formatClock, formatCountdown } from '../lib/meet-schedule';
import type { AutoJoinSnapshot } from '../lib/types';

export const PANEL_STYLE = `
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
  .panel.dismissible { cursor: pointer; }
  .message { font-weight: 600; }
  .countdown,
  .hint {
    margin-top: 2px;
    font-variant-numeric: tabular-nums;
    color: #9aa0a6;
  }
  .actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }
  .cancel,
  .postpone {
    padding: 4px 10px;
    border: 1px solid #5f6368;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .cancel:hover,
  .postpone:hover { border-color: #8ab4f8; color: #8ab4f8; }
  .actions[hidden],
  .cancel[hidden],
  .postpone[hidden] { display: none; }
`;

export function describe({ state, joinAt }: AutoJoinSnapshot): string {
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

export interface MeetPanelProps {
  snapshot: AutoJoinSnapshot;
  onCancel: () => void;
  onPostpone: () => void;
  onDismiss: () => void;
}

export function MeetPanel({ snapshot, onCancel, onPostpone, onDismiss }: MeetPanelProps) {
  const waiting = snapshot.state === 'waiting';
  // While the countdown runs the box has its own buttons, and a stray click on
  // one must not take the countdown away. Only the settled outcome closes.
  const dismissible = !waiting;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    onDismiss();
  }

  return (
    <>
      <style>{PANEL_STYLE}</style>
      <div
        className={dismissible ? 'panel dismissible' : 'panel'}
        role={dismissible ? 'button' : undefined}
        tabIndex={dismissible ? 0 : undefined}
        title={dismissible ? 'クリックで閉じる' : undefined}
        onClick={dismissible ? () => onDismiss() : undefined}
        onKeyDown={dismissible ? handleKeyDown : undefined}
      >
        <div className="title">Meet 自動入室</div>
        <div className="message">{describe(snapshot)}</div>
        {waiting ? (
          <div className="countdown">残り {formatCountdown(snapshot.remainingMs)}</div>
        ) : (
          <div className="hint">クリックで閉じる</div>
        )}
        <div className="actions" hidden={!waiting}>
          <button
            type="button"
            className="postpone"
            hidden={!waiting}
            title="参加を1分先に延ばす"
            onClick={onPostpone}
          >
            +1分
          </button>
          <button type="button" className="cancel" hidden={!waiting} onClick={onCancel}>
            キャンセル
          </button>
        </div>
      </div>
    </>
  );
}
