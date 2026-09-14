/**
 * The toggle button placed next to GitHub's merge button.
 *
 * A plain element right in GitHub's own DOM (not a shadow root like the Meet
 * panel) so it lands beside the button it refers to instead of floating over
 * the page.
 */

import type { AutoMergeSnapshot, AutoMergeState } from '../lib/github-auto-merge';

export const TOGGLE_ID = 'nanatsudougu-github-auto-merge-toggle';

const LABELS: Record<AutoMergeState, string> = {
  off: 'CIがgreenになったら自動マージ',
  watching: 'CIを監視中…（クリックで解除）',
  merging: 'マージしています…',
  done: 'マージしました',
  failed: 'CIが失敗しました',
};

export interface CreateToggleOptions {
  document: Document;
  /** The element the toggle is placed right after. */
  anchor: Element;
  onToggle: () => void;
}

export interface MergeToggle {
  mount(): void;
  update(snapshot: AutoMergeSnapshot): void;
  destroy(): void;
}

export function createMergeToggle({
  document,
  anchor,
  onToggle,
}: CreateToggleOptions): MergeToggle {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = TOGGLE_ID;
  button.textContent = LABELS.off;
  button.style.cssText = 'margin-left:8px;cursor:pointer;';
  button.addEventListener('click', onToggle);

  return {
    mount() {
      anchor.insertAdjacentElement('afterend', button);
    },

    update(snapshot) {
      button.textContent = LABELS[snapshot.state];
      button.disabled = snapshot.state === 'merging' || snapshot.state === 'done';
    },

    destroy() {
      button.remove();
    },
  };
}
