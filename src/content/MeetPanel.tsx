/**
 * The little box in the corner of the Meet waiting screen.
 *
 * It exists so the auto join is never a surprise: it says when the click will
 * happen, counts down to it, and offers a way out. It is rendered into a shadow
 * root, so the styles travel with the component instead of coming from a
 * stylesheet Meet could reach.
 */

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
}

export function MeetPanel({ snapshot, onCancel }: MeetPanelProps) {
  const waiting = snapshot.state === 'waiting';

  return (
    <>
      <style>{PANEL_STYLE}</style>
      <div className="panel">
        <div className="title">Meet 自動入室</div>
        <div className="message">{describe(snapshot)}</div>
        <div className="countdown">
          {waiting ? `残り ${formatCountdown(snapshot.remainingMs)}` : ''}
        </div>
        <button type="button" className="cancel" hidden={!waiting} onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </>
  );
}
