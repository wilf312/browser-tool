/**
 * The context menu items that copy the page's title or URL.
 *
 * The tab is what gets copied, whatever was under the pointer: a right click on
 * a link still copies the page, which is why the items say "page" in their
 * label. Chrome already offers to copy a link's own address.
 */

export const COPY_TITLE_MENU_ID = 'copy-page-title';
export const COPY_URL_MENU_ID = 'copy-page-url';

export interface PageInfo {
  title?: string;
  url?: string;
}

/**
 * The text a menu item copies, or `null` when the page has none to offer — so
 * the clipboard is left as it was instead of being emptied.
 */
export function textToCopy(menuItemId: string | number, page: PageInfo): string | null {
  if (menuItemId === COPY_TITLE_MENU_ID) return page.title || null;
  if (menuItemId === COPY_URL_MENU_ID) return page.url || null;
  return null;
}
