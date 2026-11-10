import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { COPY_MESSAGE_TYPE, OFFSCREEN_URL, writeToClipboard } from './clipboard';
import { installFakeChrome, uninstallFakeChrome, type FakeChrome } from '../../tests/fake-chrome';

let chrome: FakeChrome;
let copied: string[];

/** An offscreen document that copies whatever it is sent. */
function answerWith(ok: boolean): void {
  chrome.events.message.push((message, _sender, sendResponse) => {
    copied.push((message as { text: string }).text);
    sendResponse({ ok });
  });
}

beforeEach(() => {
  chrome = installFakeChrome();
  copied = [];
});

afterEach(() => {
  uninstallFakeChrome();
});

describe('writeToClipboard', () => {
  it('opens the offscreen document, hands it the text and closes it again', async () => {
    answerWith(true);

    await writeToClipboard('hello');

    expect(chrome.offscreen.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({ url: OFFSCREEN_URL, reasons: ['CLIPBOARD'] }),
    );
    expect(chrome.sendMessage).toHaveBeenCalledWith({ type: COPY_MESSAGE_TYPE, text: 'hello' });
    expect(copied).toEqual(['hello']);
    expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(1);
    expect(chrome.offscreenOpen).toBe(false);
  });

  it('reuses a document a previous worker left open', async () => {
    answerWith(true);
    chrome.offscreenOpen = true;

    await writeToClipboard('hello');

    expect(chrome.offscreen.createDocument).not.toHaveBeenCalled();
    expect(copied).toEqual(['hello']);
    expect(chrome.offscreenOpen).toBe(false);
  });

  it('fails, and still closes the document, when the copy did not go through', async () => {
    answerWith(false);

    await expect(writeToClipboard('hello')).rejects.toThrow('could not copy');
    expect(chrome.offscreenOpen).toBe(false);
  });

  it('fails when nothing answers the message', async () => {
    await expect(writeToClipboard('hello')).rejects.toThrow('could not copy');
    expect(chrome.offscreenOpen).toBe(false);
  });

  it('runs copies one after another, since only one document may be open', async () => {
    answerWith(true);

    await Promise.all([writeToClipboard('first'), writeToClipboard('second')]);

    expect(copied).toEqual(['first', 'second']);
    expect(chrome.offscreen.createDocument).toHaveBeenCalledTimes(2);
    expect(chrome.offscreen.closeDocument).toHaveBeenCalledTimes(2);
  });

  it('keeps copying after one copy failed', async () => {
    answerWith(true);
    chrome.offscreen.createDocument.mockRejectedValueOnce(new Error('no offscreen today'));

    const failed = writeToClipboard('first');
    const next = writeToClipboard('second');

    await expect(failed).rejects.toThrow('no offscreen today');
    await next;
    expect(copied).toEqual(['second']);
  });
});
