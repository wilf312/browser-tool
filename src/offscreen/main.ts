/**
 * Entry point of the offscreen document: it copies what the service worker
 * hands it.
 *
 * `navigator.clipboard` wants a focused document, which a page nobody sees
 * never is, so this goes through a selected textarea and `execCommand`.
 */

import { COPY_MESSAGE_TYPE, type CopyMessage, type CopyResponse } from '../lib/clipboard';

function copy(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.append(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
  }
}

chrome.runtime.onMessage.addListener(
  (
    message: Partial<CopyMessage>,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: CopyResponse) => void,
  ) => {
    if (message.type !== COPY_MESSAGE_TYPE || typeof message.text !== 'string') return;
    sendResponse({ ok: copy(message.text) });
  },
);
