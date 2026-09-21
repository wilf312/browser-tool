/**
 * The extension's UI text.
 *
 * Chrome hands the strings over from `_locales/<locale>/messages.json`. The
 * Japanese file — the default locale — is imported as well, so the helpers keep
 * answering when the extension APIs are not around: unit tests, plain Node, and
 * any build step that evaluates a module before `chrome` exists.
 *
 * Keys are typed from that file, so an unknown key is a compile error.
 */

import defaultMessages from '../../public/_locales/ja/messages.json';

export type MessageKey = keyof typeof defaultMessages;

type Substitutions = string | string[];

/** The slice of `chrome.i18n` this module needs. */
interface I18nApi {
  getMessage(messageName: string, substitutions?: Substitutions): string;
}

function chromeI18n(): I18nApi | undefined {
  const chromeValue = Reflect.get(globalThis, 'chrome') as { i18n?: I18nApi } | undefined;
  return chromeValue?.i18n;
}

/** Replace `$1`, `$2`, … the way `chrome.i18n` would. */
function fill(template: string, substitutions: readonly string[]): string {
  return template.replace(/\$(\d)/g, (whole, index: string) => {
    const value = substitutions[Number(index) - 1];
    return value ?? whole;
  });
}

/**
 * The message for `key` in the current locale, with the substitutions filled
 * in. Falls back to the default locale when `chrome.i18n` cannot answer.
 */
export function t(key: MessageKey, substitutions?: Substitutions): string {
  const api = chromeI18n();
  if (api) {
    try {
      const translated = api.getMessage(key, substitutions);
      if (translated) return translated;
    } catch {
      // A substitution count mismatch throws; the default locale is fine.
    }
  }

  const template: string = defaultMessages[key].message;
  if (substitutions === undefined) return template;
  return fill(template, Array.isArray(substitutions) ? substitutions : [substitutions]);
}
