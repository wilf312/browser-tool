import { describe, it, expect } from 'vitest';
import { normalizeHost, resolveRedirect, buildDnrRules } from '../src/lib/redirect';

describe('normalizeHost', () => {
  it('trims and lowercases', () => {
    expect(normalizeHost('  A.Atlassian.NET ')).toBe('a.atlassian.net');
  });

  it('strips the scheme', () => {
    expect(normalizeHost('https://a.atlassian.net')).toBe('a.atlassian.net');
    expect(normalizeHost('http://a.atlassian.net')).toBe('a.atlassian.net');
  });

  it('strips a path, query and hash', () => {
    expect(normalizeHost('https://a.atlassian.net/browse/XAPP-134?x=1#y')).toBe('a.atlassian.net');
    expect(normalizeHost('a.atlassian.net/')).toBe('a.atlassian.net');
  });

  it('keeps a port', () => {
    expect(normalizeHost('http://localhost:8080/x')).toBe('localhost:8080');
  });

  it('returns an empty string for empty or non-string input', () => {
    expect(normalizeHost('')).toBe('');
    expect(normalizeHost('   ')).toBe('');
    expect(normalizeHost(undefined)).toBe('');
    expect(normalizeHost(null)).toBe('');
    expect(normalizeHost(42)).toBe('');
  });
});

describe('resolveRedirect', () => {
  const rules = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true }];

  it('redirects to the export destination keeping the pathname', () => {
    expect(resolveRedirect('https://a.atlassian.net/browse/XAPP-134', rules))
      .toBe('https://b.atlassian.net/browse/XAPP-134');
  });

  it('keeps the query string and the hash', () => {
    expect(resolveRedirect('https://a.atlassian.net/issues/?jql=project%3DXAPP#top', rules))
      .toBe('https://b.atlassian.net/issues/?jql=project%3DXAPP#top');
  });

  it('keeps the root path', () => {
    expect(resolveRedirect('https://a.atlassian.net/', rules)).toBe('https://b.atlassian.net/');
  });

  it('keeps the scheme', () => {
    expect(resolveRedirect('http://a.atlassian.net/browse/X-1', rules))
      .toBe('http://b.atlassian.net/browse/X-1');
  });

  it('matches the host case-insensitively', () => {
    expect(resolveRedirect('https://A.Atlassian.NET/browse/X-1', rules))
      .toBe('https://b.atlassian.net/browse/X-1');
  });

  it('does not match a host that merely ends with the from host', () => {
    expect(resolveRedirect('https://xa.atlassian.net/browse/X-1', rules)).toBeNull();
  });

  it('does not match a subdomain of the from host', () => {
    expect(resolveRedirect('https://sub.a.atlassian.net/browse/X-1', rules)).toBeNull();
  });

  it('returns null when no rule matches', () => {
    expect(resolveRedirect('https://c.atlassian.net/browse/X-1', rules)).toBeNull();
  });

  it('ignores disabled rules', () => {
    const disabled = [{ id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false }];
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', disabled)).toBeNull();
  });

  it('ignores a rule whose from and to are the same host', () => {
    const same = [{ id: '1', from: 'a.atlassian.net', to: 'A.atlassian.net', enabled: true }];
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', same)).toBeNull();
  });

  it('ignores incomplete rules', () => {
    const broken = [
      { id: '1', from: '', to: 'b.atlassian.net', enabled: true },
      { id: '2', from: 'a.atlassian.net', to: '', enabled: true },
    ];
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', broken)).toBeNull();
  });

  it('accepts rules written with a scheme or a trailing slash', () => {
    const messy = [{ id: '1', from: 'https://a.atlassian.net/', to: 'https://b.atlassian.net', enabled: true }];
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', messy))
      .toBe('https://b.atlassian.net/browse/X-1');
  });

  it('uses the first matching enabled rule', () => {
    const many = [
      { id: '1', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false },
      { id: '2', from: 'a.atlassian.net', to: 'c.atlassian.net', enabled: true },
      { id: '3', from: 'a.atlassian.net', to: 'd.atlassian.net', enabled: true },
    ];
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', many))
      .toBe('https://c.atlassian.net/browse/X-1');
  });

  it('returns null for a url it cannot parse', () => {
    expect(resolveRedirect('not a url', rules)).toBeNull();
    expect(resolveRedirect('', rules)).toBeNull();
    expect(resolveRedirect(undefined, rules)).toBeNull();
  });

  it('returns null when there are no rules', () => {
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', [])).toBeNull();
    expect(resolveRedirect('https://a.atlassian.net/browse/X-1', undefined)).toBeNull();
  });
});

describe('buildDnrRules', () => {
  it('builds a main_frame host transform rule per enabled rule', () => {
    const built = buildDnrRules([
      { id: 'x', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: true },
    ]);
    expect(built).toEqual([
      {
        id: 1,
        priority: 1,
        action: { type: 'redirect', redirect: { transform: { host: 'b.atlassian.net' } } },
        condition: {
          urlFilter: '||a.atlassian.net/',
          resourceTypes: ['main_frame'],
        },
      },
    ]);
  });

  it('numbers the rules from 1 without gaps, skipping disabled and invalid rules', () => {
    const built = buildDnrRules([
      { id: 'a', from: 'a.atlassian.net', to: 'b.atlassian.net', enabled: false },
      { id: 'b', from: 'c.atlassian.net', to: 'd.atlassian.net', enabled: true },
      { id: 'c', from: '', to: 'e.atlassian.net', enabled: true },
      { id: 'd', from: 'f.atlassian.net', to: 'f.atlassian.net', enabled: true },
      { id: 'e', from: 'g.atlassian.net', to: 'h.atlassian.net', enabled: true },
    ]);
    expect(built.map((r) => r.id)).toEqual([1, 2]);
    expect(built.map((r) => r.condition.urlFilter)).toEqual(['||c.atlassian.net/', '||g.atlassian.net/']);
    expect(built.map((r) => r.action.redirect?.transform?.host)).toEqual(['d.atlassian.net', 'h.atlassian.net']);
  });

  it('returns an empty array for no rules', () => {
    expect(buildDnrRules([])).toEqual([]);
    expect(buildDnrRules(undefined)).toEqual([]);
  });
});
