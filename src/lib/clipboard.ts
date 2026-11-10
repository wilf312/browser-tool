/**
 * Writing to the clipboard from the service worker.
 *
 * The worker has no document, so it cannot copy anything itself. An offscreen
 * document — an extension page nobody sees — does it on its behalf. It is
 * opened for one copy and closed right after, so it holds no memory between
 * two clicks.
 *
 * Copying there rather than in the tab is what makes it work on every page: a
 * script in the tab fails on plain http pages, while focus is in a frame, and
 * on the pages extensions cannot touch at all.
 */

export const OFFSCREEN_URL = 'offscreen.html';
export const COPY_MESSAGE_TYPE = 'copy-to-clipboard';

export interface CopyMessage {
  type: typeof COPY_MESSAGE_TYPE;
  text: string;
}

export interface CopyResponse {
  ok: boolean;
}

async function writeOnce(text: string): Promise<void> {
  // A worker that was shut down mid-copy can leave one behind, and only one
  // may be open at a time.
  if (!(await chrome.offscreen.hasDocument())) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.CLIPBOARD],
      justification: 'Copy the page title or URL the user picked from the context menu.',
    });
  }

  try {
    const message: CopyMessage = { type: COPY_MESSAGE_TYPE, text };
    const response = await chrome.runtime.sendMessage<CopyMessage, CopyResponse | undefined>(
      message,
    );
    if (!response?.ok) throw new Error('the offscreen document could not copy the text');
  } finally {
    await chrome.offscreen.closeDocument();
  }
}

let queue: Promise<void> = Promise.resolve();

/**
 * Put `text` on the clipboard. Copies run one after another, since two of them
 * would race for the single offscreen document.
 */
export function writeToClipboard(text: string): Promise<void> {
  const run = queue.then(() => writeOnce(text));
  queue = run.catch(() => {});
  return run;
}
