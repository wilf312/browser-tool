/** jsdom has no object URLs and no downloader, so both are stood in for here. */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { downloadText } from './download';

let createObjectURL: ReturnType<typeof vi.fn>;
let revokeObjectURL: ReturnType<typeof vi.fn>;
let clicked: HTMLAnchorElement[];

beforeEach(() => {
  vi.useFakeTimers();
  createObjectURL = vi.fn(() => 'blob:settings');
  revokeObjectURL = vi.fn();
  Object.assign(URL, { createObjectURL, revokeObjectURL });

  clicked = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
    function (this: HTMLAnchorElement) {
      clicked.push(this);
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('downloadText', () => {
  it('clicks an anchor pointing at the text, under the given filename', async () => {
    downloadText('settings.json', '{"a":1}');

    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe('settings.json');
    expect(clicked[0].getAttribute('href')).toBe('blob:settings');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json');
    await expect(blob.text()).resolves.toBe('{"a":1}');
  });

  it('takes another content type when asked', () => {
    downloadText('notes.txt', 'hello', 'text/plain');

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/plain');
  });

  it('leaves no anchor behind on the page', () => {
    downloadText('settings.json', '{}');

    expect(document.querySelector('a')).toBeNull();
  });

  it('releases the object URL once the click has been handled', () => {
    downloadText('settings.json', '{}');

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:settings');
  });
});
