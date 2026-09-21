import { afterEach, describe, expect, it } from 'vitest';
import { t } from './i18n';

/** Put a stand-in `chrome.i18n` on the global, the way the extension provides one. */
function useChromeI18n(
  getMessage: (name: string, substitutions?: string | string[]) => string,
): void {
  Reflect.set(globalThis, 'chrome', { i18n: { getMessage } });
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'chrome');
});

describe('t', () => {
  it('answers from the default locale when chrome.i18n is not around', () => {
    expect(t('saved')).toBe('保存しました');
  });

  it('fills positional substitutions', () => {
    expect(t('unit_minutes', ['5'])).toBe('5 分');
    expect(t('describe_rules', ['2', '1'])).toBe('ルール 2 件（有効 1 件）');
  });

  it('accepts a single substitution without an array', () => {
    expect(t('panel_remaining', '05:00')).toBe('残り 05:00');
  });

  it('prefers the string chrome.i18n returns', () => {
    useChromeI18n(() => 'Saved');
    expect(t('saved')).toBe('Saved');
  });

  it('falls back when chrome.i18n has nothing for the key', () => {
    useChromeI18n(() => '');
    expect(t('saved')).toBe('保存しました');
  });

  it('falls back when chrome.i18n throws', () => {
    useChromeI18n(() => {
      throw new Error('substitution count mismatch');
    });
    expect(t('saved')).toBe('保存しました');
  });

  it('falls back when chrome itself is present but chrome.i18n is not', () => {
    Reflect.set(globalThis, 'chrome', { storage: {} });
    expect(t('saved')).toBe('保存しました');
  });
});
