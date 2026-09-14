import { describe, it, expect, beforeEach } from 'vitest';
import { findCiStatus } from './github-ci-status';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findCiStatus', () => {
  it('reports success once every check has passed', () => {
    document.body.innerHTML = '<h3>All checks have passed</h3>';
    expect(findCiStatus(document)).toBe('success');
  });

  it('reports pending while checks are still running', () => {
    document.body.innerHTML = "<h3>Some checks haven't completed yet</h3>";
    expect(findCiStatus(document)).toBe('pending');
  });

  it('reports failure when a check did not pass', () => {
    document.body.innerHTML = '<h3>Some checks were not successful</h3>';
    expect(findCiStatus(document)).toBe('failure');
  });

  it('reports unknown before the merge box has rendered', () => {
    document.body.innerHTML = '<div>Loading…</div>';
    expect(findCiStatus(document)).toBe('unknown');
  });

  it('collapses whitespace so a wrapped phrase still matches', () => {
    document.body.innerHTML = '<h3>All checks\nhave   passed</h3>';
    expect(findCiStatus(document)).toBe('success');
  });

  it('prefers failure over a stale pending phrase left elsewhere on the page', () => {
    document.body.innerHTML = `
      <div>Some checks haven't completed yet</div>
      <div>Some checks were not successful</div>
    `;
    expect(findCiStatus(document)).toBe('failure');
  });

  it('returns unknown without a usable root', () => {
    expect(findCiStatus(null)).toBe('unknown');
    expect(findCiStatus({} as ParentNode)).toBe('unknown');
  });

  it('searches the whole page when no root is given', () => {
    document.body.innerHTML = '<h3>All checks have passed</h3>';
    expect(findCiStatus()).toBe('success');
  });
});
