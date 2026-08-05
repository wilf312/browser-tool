/**
 * Mounts `<MeetPanel />` on the Meet page.
 *
 * The React root lives in a shadow root attached to a fixed-position host, so
 * Meet's stylesheet cannot reach the panel (and ours cannot reach Meet).
 * Renders are flushed synchronously: the caller updates the panel from a timer
 * and the tests read the DOM straight afterwards.
 */

import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MeetPanel } from './MeetPanel';
import type { AutoJoinSnapshot } from '../lib/types';

export const PANEL_ID = 'nanatsudougu-meet-auto-join';

export interface Panel {
  host: HTMLElement;
  mount(): void;
  update(snapshot: AutoJoinSnapshot): void;
  destroy(): void;
}

export interface CreatePanelOptions {
  document: Document;
  onCancel?: () => void;
}

export function createPanel({ document, onCancel = () => {} }: CreatePanelOptions): Panel {
  const host = document.createElement('div');
  host.id = PANEL_ID;
  // Pinned bottom-left: Meet's own chat / participant buttons sit in the
  // bottom-right corner, and a panel there covers them.
  host.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:2147483647;';

  const shadow = host.attachShadow({ mode: 'open' });
  let root: Root | null = null;

  return {
    host,

    mount() {
      (document.body ?? document.documentElement).append(host);
      root ??= createRoot(shadow);
    },

    update(snapshot) {
      if (!root) return;
      flushSync(() => {
        root?.render(<MeetPanel snapshot={snapshot} onCancel={onCancel} />);
      });
    },

    destroy() {
      root?.unmount();
      root = null;
      host.remove();
    },
  };
}
