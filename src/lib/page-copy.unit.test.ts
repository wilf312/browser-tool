import { describe, it, expect } from 'vitest';
import { COPY_TITLE_MENU_ID, COPY_URL_MENU_ID, textToCopy } from './page-copy';

const PAGE = { title: 'XAPP-134 - Jira', url: 'https://b.atlassian.net/browse/XAPP-134' };

describe('textToCopy', () => {
  it('copies the title for the title item', () => {
    expect(textToCopy(COPY_TITLE_MENU_ID, PAGE)).toBe('XAPP-134 - Jira');
  });

  it('copies the URL for the URL item', () => {
    expect(textToCopy(COPY_URL_MENU_ID, PAGE)).toBe('https://b.atlassian.net/browse/XAPP-134');
  });

  it('copies nothing when the page has no title, so the clipboard keeps what it had', () => {
    expect(textToCopy(COPY_TITLE_MENU_ID, { url: PAGE.url })).toBeNull();
    expect(textToCopy(COPY_TITLE_MENU_ID, { title: '', url: PAGE.url })).toBeNull();
  });

  it('copies nothing when the URL is unknown', () => {
    expect(textToCopy(COPY_URL_MENU_ID, { title: PAGE.title })).toBeNull();
  });

  it('ignores items that are not its own', () => {
    expect(textToCopy('something-else', PAGE)).toBeNull();
    expect(textToCopy(3, PAGE)).toBeNull();
  });
});
