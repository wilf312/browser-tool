import { describe, it, expect } from 'vitest';
import { isPullRequestUrl } from './github-pr-page';

describe('isPullRequestUrl', () => {
  it('accepts a pull request page', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool/pull/42')).toBe(true);
  });

  it('accepts a tab of a pull request page', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool/pull/42/files')).toBe(true);
  });

  it('rejects the repository root', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool')).toBe(false);
  });

  it('rejects the pull request list', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool/pulls')).toBe(false);
  });

  it('rejects an issue page', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool/issues/42')).toBe(false);
  });

  it('rejects a non-numeric pull request id', () => {
    expect(isPullRequestUrl('https://github.com/wilf312/browser-tool/pull/new')).toBe(false);
  });

  it('rejects a different host', () => {
    expect(isPullRequestUrl('https://gitlab.com/wilf312/browser-tool/pull/42')).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isPullRequestUrl('not a url')).toBe(false);
    expect(isPullRequestUrl(undefined)).toBe(false);
    expect(isPullRequestUrl('')).toBe(false);
  });
});
