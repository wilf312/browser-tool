import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Every `public/_locales/<locale>/messages.json`, keyed by locale. */
interface Message {
  message: string;
  description?: string;
}

type MessageFile = Record<string, Message>;

const localesDir = resolve(process.cwd(), 'public/_locales');

function readLocale(locale: string): MessageFile {
  return JSON.parse(
    readFileSync(resolve(localesDir, locale, 'messages.json'), 'utf8'),
  ) as MessageFile;
}

function readLocales(): string[] {
  return readdirSync(localesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/** The `$1`, `$2`, … placeholders a message uses, so translations must keep them. */
function placeholders(message: string): Set<string> {
  return new Set([...message.matchAll(/\$(\d)/g)].map((match) => match[1]));
}

const locales = readLocales();
const base = readLocale('ja');
const baseKeys = Object.keys(base);

describe('_locales', () => {
  it('keeps Japanese as the default locale', () => {
    expect(locales).toContain('ja');
  });

  it('ships the locales the store listing documents', () => {
    expect(new Set(locales)).toEqual(new Set(['en', 'es', 'ja', 'zh_CN']));
  });

  it.each(locales)('%s defines exactly the same keys as the default locale', (locale) => {
    expect(new Set(Object.keys(readLocale(locale)))).toEqual(new Set(baseKeys));
  });

  it.each(locales)('%s keeps every placeholder of the default locale', (locale) => {
    const messages = readLocale(locale);
    for (const key of baseKeys) {
      expect(placeholders(messages[key].message), `${locale}/${key}`).toEqual(
        placeholders(base[key].message),
      );
    }
  });

  it.each(locales)('%s has a non-empty message for every key', (locale) => {
    const messages = readLocale(locale);
    for (const key of baseKeys) {
      expect(messages[key].message.length, `${locale}/${key}`).toBeGreaterThan(0);
    }
  });
});
