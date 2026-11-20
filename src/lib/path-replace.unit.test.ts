import { describe, expect, it } from 'vitest';
import {
  parsePattern,
  pathReplaceRuleProblem,
  permissionOrigin,
  resolvePathReplace,
} from './path-replace';
import type { PathReplaceRule } from './types';

function rule(patch: Partial<PathReplaceRule> = {}): PathReplaceRule {
  return { id: '1', pattern: 'example.com', from: 'old', to: 'new', mode: 'confirm', ...patch };
}

describe('parsePattern', () => {
  it('splits the host from the path', () => {
    expect(parsePattern('*.example.com/docs/*')).toEqual({
      host: '*.example.com',
      path: '/docs/*',
    });
  });

  it('matches every path when none is given', () => {
    expect(parsePattern('example.com')).toEqual({ host: 'example.com', path: '' });
  });

  it('drops the scheme, the port and the case of the host', () => {
    expect(parsePattern(' https://Example.COM:8080/Docs ')).toEqual({
      host: 'example.com',
      path: '/Docs',
    });
  });

  it('refuses a pattern without a host', () => {
    expect(parsePattern('')).toBeNull();
    expect(parsePattern('/docs/*')).toBeNull();
    expect(parsePattern(undefined)).toBeNull();
  });
});

describe('resolvePathReplace', () => {
  it('replaces the text in the path and keeps the query and the hash', () => {
    expect(
      resolvePathReplace('https://example.com/docs/old/a?q=old#old', [
        rule({ pattern: 'example.com/docs/*' }),
      ]),
    ).toEqual({ url: 'https://example.com/docs/new/a?q=old#old', mode: 'confirm' });
  });

  it('replaces every occurrence', () => {
    expect(resolvePathReplace('https://example.com/old/old', [rule()])?.url).toBe(
      'https://example.com/new/new',
    );
  });

  it('reports the mode of the rule that matched', () => {
    expect(resolvePathReplace('https://example.com/old', [rule({ mode: 'always' })])?.mode).toBe(
      'always',
    );
  });

  it('matches the host with a wildcard', () => {
    const rules = [rule({ pattern: '*.example.com' })];
    expect(resolvePathReplace('https://a.example.com/old', rules)?.url).toBe(
      'https://a.example.com/new',
    );
    expect(resolvePathReplace('https://a.b.example.com/old', rules)).not.toBeNull();
    expect(resolvePathReplace('https://example.org/old', rules)).toBeNull();
  });

  it('matches the path with a wildcard, against the whole path', () => {
    const rules = [rule({ pattern: 'example.com/docs/*/edit' })];
    expect(resolvePathReplace('https://example.com/docs/old/edit', rules)?.url).toBe(
      'https://example.com/docs/new/edit',
    );
    expect(resolvePathReplace('https://example.com/docs/old/view', rules)).toBeNull();
    expect(resolvePathReplace('https://example.com/x/docs/old/edit', rules)).toBeNull();
  });

  it('matches the path case sensitively and the host case insensitively', () => {
    expect(resolvePathReplace('https://EXAMPLE.com/old', [rule()])).not.toBeNull();
    expect(resolvePathReplace('https://example.com/OLD', [rule()])).toBeNull();
  });

  it('only looks at the path, not the host or the query', () => {
    const rules = [rule({ pattern: 'old.example.com', from: 'old' })];
    expect(resolvePathReplace('https://old.example.com/a?old=1', rules)).toBeNull();
  });

  it('replaces text that is percent-encoded in the URL', () => {
    expect(
      resolvePathReplace('https://example.com/%E6%97%A7/a', [rule({ from: '旧', to: '新' })])?.url,
    ).toBe('https://example.com/%E6%96%B0/a');
  });

  it('skips disabled and unusable rules and takes the first that applies', () => {
    const rules = [
      rule({ mode: 'disabled', to: 'off' }),
      rule({ from: '' }),
      rule({ pattern: '' }),
      rule({ from: 'missing' }),
      rule({ to: 'second' }),
      rule({ to: 'third' }),
    ];
    expect(resolvePathReplace('https://example.com/old', rules)?.url).toBe(
      'https://example.com/second',
    );
  });

  it('refuses a rule whose replacement would match again', () => {
    expect(
      resolvePathReplace('https://example.com/v1/a', [rule({ from: 'v1', to: 'v1/new' })]),
    ).toBeNull();
  });

  it('leaves anything but web pages alone', () => {
    expect(resolvePathReplace('chrome://example.com/old', [rule()])).toBeNull();
    expect(resolvePathReplace('not a url', [rule()])).toBeNull();
    expect(resolvePathReplace('', [rule()])).toBeNull();
    expect(resolvePathReplace('https://example.com/old', [])).toBeNull();
    expect(resolvePathReplace('https://example.com/old', 'nope')).toBeNull();
  });
});

describe('pathReplaceRuleProblem', () => {
  it('points out a replacement that contains what it replaces', () => {
    expect(pathReplaceRuleProblem(rule({ from: 'v1', to: 'v1/new' }))).toBe('loops');
    expect(pathReplaceRuleProblem(rule())).toBeNull();
    expect(pathReplaceRuleProblem(rule({ from: '' }))).toBeNull();
  });
});

describe('permissionOrigin', () => {
  it('asks for the host the pattern names', () => {
    expect(permissionOrigin('example.com/docs/*')).toBe('*://example.com/*');
    expect(permissionOrigin('*.example.com')).toBe('*://*.example.com/*');
    expect(permissionOrigin('example.com:8080')).toBe('*://example.com/*');
  });

  it('falls back to every host for a wildcard a match pattern cannot hold', () => {
    expect(permissionOrigin('*')).toBe('*://*/*');
    expect(permissionOrigin('dev-*.example.com')).toBe('*://*/*');
    expect(permissionOrigin('*.*.example.com')).toBe('*://*/*');
  });

  it('has nothing to ask for without a host', () => {
    expect(permissionOrigin('')).toBeNull();
  });
});
