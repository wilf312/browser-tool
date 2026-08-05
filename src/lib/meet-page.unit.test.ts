import { describe, it, expect } from 'vitest';
import { isMeetingUrl } from './meet-page';

describe('isMeetingUrl', () => {
  it('accepts a meeting code', () => {
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij')).toBe(true);
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij?authuser=1')).toBe(true);
    expect(isMeetingUrl('https://meet.google.com/abc-defg-hij#hash')).toBe(true);
  });

  it('rejects the pages without a join button', () => {
    expect(isMeetingUrl('https://meet.google.com/')).toBe(false);
    expect(isMeetingUrl('https://meet.google.com/new')).toBe(false);
    expect(isMeetingUrl('https://meet.google.com/landing')).toBe(false);
    expect(isMeetingUrl('https://meet.google.com/lookup/abcdefghij')).toBe(false);
  });

  it('rejects other hosts', () => {
    expect(isMeetingUrl('https://example.com/abc-defg-hij')).toBe(false);
    expect(isMeetingUrl('https://meet.google.com.evil.test/abc-defg-hij')).toBe(false);
  });

  it('rejects anything that is not a url', () => {
    expect(isMeetingUrl('')).toBe(false);
    expect(isMeetingUrl('abc-defg-hij')).toBe(false);
    expect(isMeetingUrl(undefined)).toBe(false);
  });
});
