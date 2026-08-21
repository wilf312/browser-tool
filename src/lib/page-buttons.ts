/**
 * Reading the buttons Meet renders.
 *
 * Meet's markup is generated and its class names change, so every button this
 * extension clicks is found by its visible label. Both `<button>` and
 * `[role="button"]` are used on the page, and a label can live on the element's
 * text, on its `aria-label`, or on both.
 */

/** The label as one string — for matching a phrase inside a longer label. */
export function labelOf(element: Element): string {
  const aria = element.getAttribute('aria-label');
  const text = element.textContent ?? '';
  return `${aria ?? ''} ${text}`.replace(/\s+/g, ' ').trim();
}

/** The label candidates on their own — for matching a whole label. */
export function exactLabelsOf(element: Element): string[] {
  const aria = element.getAttribute('aria-label');
  const text = element.textContent ?? '';
  return [aria, text]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/\s+/g, ' ').trim());
}

/** Whether the element can be clicked, as far as the DOM tells us. */
export function isClickable(element: Element): boolean {
  if ((element as HTMLButtonElement).disabled) return false;
  if ((element as HTMLElement).hidden) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  if (element.closest('[aria-hidden="true"]')) return false;
  return true;
}

/** Every button under `root` that is there to be clicked. */
export function clickableButtons(root: ParentNode | null | undefined): HTMLElement[] {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  return Array.from(root.querySelectorAll<HTMLElement>('button, [role="button"]')).filter(
    isClickable,
  );
}
