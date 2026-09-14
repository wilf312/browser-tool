import { describe, it, expect, beforeEach } from 'vitest';
import { findConfirmMergeButton, findMergeButton } from './github-merge-button';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('findMergeButton', () => {
  it('finds the default merge button', () => {
    document.body.innerHTML = '<button>Merge pull request</button>';
    expect(findMergeButton(document)?.textContent).toBe('Merge pull request');
  });

  it('finds the squash merge button', () => {
    document.body.innerHTML = '<button>Squash and merge</button>';
    expect(findMergeButton(document)?.textContent).toBe('Squash and merge');
  });

  it('finds the rebase merge button', () => {
    document.body.innerHTML = '<button>Rebase and merge</button>';
    expect(findMergeButton(document)?.textContent).toBe('Rebase and merge');
  });

  it('finds a role=button element', () => {
    document.body.innerHTML = '<div role="button" aria-label="Merge pull request"></div>';
    expect(findMergeButton(document)?.getAttribute('aria-label')).toBe('Merge pull request');
  });

  it('does not match the caret that opens the merge method menu', () => {
    document.body.innerHTML = '<button aria-label="Select merge method"></button>';
    expect(findMergeButton(document)).toBeNull();
  });

  it('skips buttons that cannot be clicked', () => {
    document.body.innerHTML = '<button disabled>Merge pull request</button>';
    expect(findMergeButton(document)).toBeNull();
  });

  it('returns null before the merge box has rendered', () => {
    document.body.innerHTML = '<div>Loading…</div>';
    expect(findMergeButton(document)).toBeNull();
  });
});

describe('findConfirmMergeButton', () => {
  it('finds the confirm merge button', () => {
    document.body.innerHTML = '<button>Confirm merge</button>';
    expect(findConfirmMergeButton(document)?.textContent).toBe('Confirm merge');
  });

  it('finds the confirm squash and merge button', () => {
    document.body.innerHTML = '<button>Confirm squash and merge</button>';
    expect(findConfirmMergeButton(document)?.textContent).toBe('Confirm squash and merge');
  });

  it('returns null while the commit message form is not open', () => {
    document.body.innerHTML = '<button>Merge pull request</button>';
    expect(findConfirmMergeButton(document)).toBeNull();
  });
});
